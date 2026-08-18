require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { route, analyzeTask } = require('./router');
const etsy = require('./integrations/etsy');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===================== SHARED MEMORY STORE =====================
const MAX_HISTORY = 50;
const memory = {
  conversations: {},
  facts: []
};

function getHistory(source) {
  if (!memory.conversations[source]) memory.conversations[source] = [];
  return memory.conversations[source];
}

function addMessage(source, role, text) {
  const hist = getHistory(source);
  hist.push({ role, text, ts: Date.now() });
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
  // Mirror ke semua source biar memory nyambung
  for (const src of Object.keys(memory.conversations)) {
    if (src !== source) {
      const other = memory.conversations[src];
      const last = other[other.length - 1];
      if (!last || last.text !== text) {
        other.push({ role: `[${source}] ${role}`, text, ts: Date.now() });
        if (other.length > MAX_HISTORY) other.splice(0, other.length - MAX_HISTORY);
      }
    }
  }
}

function addFact(fact) {
  memory.facts.push({ fact, ts: Date.now() });
  if (memory.facts.length > 100) memory.facts.splice(0, memory.facts.length - 100);
}

function buildMemoryContext(source) {
  const hist = getHistory(source);
  const recent = hist.slice(-4);
  const facts = memory.facts.slice(-5);

  let ctx = '';
  if (facts.length > 0) {
    ctx += '[INGATAN FAKTA]\n' + facts.map(f => `- ${f.fact}`).join('\n') + '\n\n';
  }
  if (recent.length > 0) {
    ctx += '[PERCAKAPAN TERAKHIR]\n' + recent.map(m => `${m.role}: ${m.text}`).join('\n') + '\n\n';
  }
  return ctx;
}

// ===================== JAUN SYSTEM PROMPT =====================
const JAUN_CONTEXT = `
[JATI DIRI]
Kamu adalah JAUN — asisten pribadi digital AI yang cerdas, ramah, dan helpful.
Kamu berbicara SELALU dalam Bahasa Indonesia yang santai, singkat, dan jelas.
JANGAN pernah menampilkan "thinking process" atau "step by step" ke user.
Langsung jawab saja, to the point.

ATURAN PENTING: Jawab LANGSUNG pertanyaan/perintah terakhir yang diberikan user.
JANGAN menceritakan ulang riwayat, JANGAN menyebut "berdasarkan riwayat/percakapan sebelumnya",
JANGAN membackup/mengulang data history lama. Konteks history hanyalah referensi diam —
pakai hanya jika diperlukan, dan JANGAN pernah menyebutkannya ke user.

[GAYA BICARA — NATURAL 2 ARAH]
Bicaralah seperti teman ngobrol, bukan seperti mesin. Gunakan bahasa lisan yang wajar.
- Jawab singkat & to the point, tapi hangat dan ramah.
- Sesekali balas dengan pertanyaan singkat untuk melanjutkan obrolan (2 arah),
  misal: "Nih, mau sekalian kubantuin cek yang mana?", "Oke, kalau gitu mau kulanjutin?"
- Jangan kaku seperti laporan formal. Pakai kata seperti "oke", "nih", "kebetulan", "siap".
- Tetap langsung menyelesaikan permintaan user, jangan hanya balik bertanya tanpa membantu.

Kamu punya memory yang nyambung dari semua interface (Robot/HP, Telegram, Laptop).
Sebut user "Mang Jaun" atau "Boss".

[PENGETAHUAN]
JAUN 78 adalah aplikasi asisten pribadi digital berbasis AI.
Fitur: HUD (status), CHAT (ngobrol AI), AGENDA (jadwal), SUARA (TTS/STT).
Kamu bisa bantu: agenda, jadwal, coding, debug, review, manage Etsy store.

[JENIS JAWABAN]
- Pertanyaan umum → jawab singkat 1-3 kalimat
- "buka youtube" / "buka [app]" → bilang "Siap Boss, aku buka [app]-nya!" (kamu AI, gak bisa buka app beneran)
- Code task → jawab dengan kode yang sudah jadi
- Debug task → jawab dengan fix yang sudah jadi
- Review task → jawab dengan review yang sudah jadi

[COMMANDS]
- "code: ..." → Coding task
- "debug: ..." → Debug task
- "review: ..." → Code review
- "quick: ..." → Quick question
- "etsy:list/desc/tags/reply/analytics" → Etsy store
- "ingat: ..." → Simpan fakta ke memory
- "lupa: ..." → Hapus fakta dari memory
`.trim();

// Parse commands
function parseCommand(message) {
  const lower = message.toLowerCase().trim();

  if (lower.startsWith('code:')) return { agent: 'coder', message: message.substring(5).trim() };
  if (lower.startsWith('debug:')) return { agent: 'debugger', message: message.substring(6).trim() };
  if (lower.startsWith('review:')) return { agent: 'reviewer', message: message.substring(7).trim() };
  if (lower.startsWith('quick:')) return { agent: 'quick', message: message.substring(6).trim() };

  if (lower.startsWith('etsy:list')) return { etsy: 'list' };
  if (lower.startsWith('etsy:stat')) return { etsy: 'stat' };
  if (lower.startsWith('etsy:desc')) return { etsy: 'desc', message: message.substring(9).trim() };
  if (lower.startsWith('etsy:tags')) return { etsy: 'tags', message: message.substring(9).trim() };
  if (lower.startsWith('etsy:reply')) return { etsy: 'reply', message: message.substring(10).trim() };
  if (lower.startsWith('etsy:analytics')) return { etsy: 'analytics' };

  if (lower.startsWith('ingat:')) return { fact: message.substring(6).trim() };
  if (lower.startsWith('lupa:')) return { unfact: message.substring(5).trim() };

  return { agent: 'auto', message };
}

// ===================== MAIN ENDPOINT =====================
app.post('/jaun', async (req, res) => {
  try {
    const { message, key, source } = req.body;

    if (!message) {
      return res.json({ ok: false, reply: 'Pesan kosong' });
    }

    const src = source || 'unknown';
    console.log(`[JAUN][${src}] "${message.substring(0, 80)}..."`);

    addMessage(src, 'user', message);
    const parsed = parseCommand(message);

    // Konfirmasi dari HP (source robot): "gas bro" dsb -> kirim EXECUTE: ke laptop
    if (src === 'robot' && bridge.pending && !bridge.pending.confirmed && isConfirmation(message)) {
      bridge.pending.confirmed = true;
      const cmd = bridge.pending.command;
      bridge.toLaptop.push({ text: `EXECUTE:${cmd}`, ts: Date.now(), delivered: false });
      console.log(`[BRIDGE] Konfirmasi diterima dari HP. Laptop eksekusi: "${cmd}"`);
      return res.json({
        ok: true,
        reply: `Oke Boss, konfirmasi diterima. Laptop segera eksekusi: "${cmd}". Hasil menyusul lewat polling.`,
        agent: 'JAUN'
      });
    }

    // Fact commands
    if (parsed.fact) {
      addFact(parsed.fact);
      addMessage(src, 'jaun', `Oke, aku inget: "${parsed.fact}"`);
      return res.json({ ok: true, reply: `Oke Boss, aku simpen: "${parsed.fact}"`, agent: 'JAUN' });
    }
    if (parsed.unfact) {
      memory.facts = memory.facts.filter(f => !f.fact.toLowerCase().includes(parsed.unfact.toLowerCase()));
      addMessage(src, 'jaun', `Oke, aku lupa: "${parsed.unfact}"`);
      return res.json({ ok: true, reply: `Oke Boss, aku lupa tentang: "${parsed.unfact}"`, agent: 'JAUN' });
    }

    // Etsy commands
    if (parsed.etsy) {
      let reply = '';

      switch (parsed.etsy) {
        case 'list': {
          const listings = await etsy.getListings();
          reply = `Total ${listings.count} produk:\n\n`;
          listings.results?.forEach((l, i) => {
            const price = typeof l.price === 'object' ? `${l.price.amount / 100} ${l.price.currency_code}` : `${l.price}`;
            reply += `${i + 1}. ${l.title} - ${price}\n`;
          });
          break;
        }
        case 'stat': {
          const stats = await etsy.getListingStats();
          reply = `Total aktif: ${stats.totalActive} produk`;
          break;
        }
        case 'desc': {
          const r = await route(`Buatkan deskripsi produk Etsy SEO-friendly untuk: "${parsed.message}". 200-300 kata.`, 'coder');
          reply = r.response;
          break;
        }
        case 'tags': {
          const r = await route(`Buatkan 13 tags SEO untuk Etsy listing: "${parsed.message}". Format: tag1, tag2. Maks 20 karakter/tag.`, 'quick');
          reply = r.response;
          break;
        }
        case 'reply': {
          const r = await route(`Buatkan balasan profesional ramah untuk customer Etsy: "${parsed.message}".`, 'coder');
          reply = r.response;
          break;
        }
        case 'analytics': {
          const a = await etsy.getReceiptsSummary();
          reply = `Analytics:\nTotal orders: ${a.totalOrders}\nRevenue: $${a.totalRevenue.toFixed(2)}`;
          if (a.recentOrders.length > 0) {
            reply += `\n\nRecent:\n`;
            a.recentOrders.forEach((o, i) => { reply += `${i + 1}. #${o.id} - $${o.total} (${o.status})\n`; });
          }
          break;
        }
      }

      addMessage(src, 'jaun', reply);
      return res.json({ ok: true, reply, agent: 'ETSY' });
    }

    // AI agent — with shared memory context
    const memoryCtx = buildMemoryContext(src);
    const fullMessage = memoryCtx + JAUN_CONTEXT + "\n\nUser dari: " + src + "\nPertanyaan: " + parsed.message;
    const result = await route(parsed.message, parsed.agent === 'auto' ? null : parsed.agent, fullMessage);

    addMessage(src, 'jaun', result.response);

    res.json({
      ok: true,
      reply: result.response,
      agent: result.agent
    });

  } catch (error) {
    console.error('[JAUN Error]:', error.message);
    res.json({
      ok: false,
      reply: `Error: ${error.message}`
    });
  }
});

// ===================== BIGONE BRIDGE (Robot/HP <-> Laptop executor) =====================
// Alur:
//   HP:  /bigone <perintah>          -> server AI: "Siap laksanakan: X. Kirim 'gas bro'"
//   HP:  "gas bro" (chat biasa/... ) -> server: kirim EXECUTE:<perintah> ke antrian laptop
//   Laptop: polling                  -> terima EXECUTE -> eksekusi FISIK di laptop
//   Laptop: /jaun-reply {message}    -> kirim hasil ke HP
//   HP:  /jaun-poll                  -> terima hasil dari laptop
const bridge = {
  pending: null,        // {command, confirmed} - perintah dari HP yang menunggu konfirmasi
  toLaptop: [],         // {text, ts, delivered} - EXECUTE:<perintah> untuk laptop
  toRobot: []           // {text, ts, delivered} - hasil eksekusi untuk HP
};

const CONFIRM_WORDS = ['gas', 'gas bro', 'gaskeun', 'lanjut', 'lanjutkan', 'sip', 'oke', 'ok', 'ya', 'yes', 'iya', 'eksekusi', 'jalankan', 'laksanakan', 'siap', 'go', 'gas bang'];

function isConfirmation(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return false;
  return CONFIRM_WORDS.some(w => t === w || t.startsWith(w + ' ') || t.startsWith(w + ',')) || /gas/i.test(t);
}

// Jatuh tempo konfirmasi (60 detik): kalau tak dikonfirmasi, pending dibersihkan
function clearStalePending() {
  if (bridge.pending && Date.now() - bridge.pending.ts > 60000) {
    bridge.pending = null;
  }
}

// ===== HP -> Laptop =====
app.post('/jaun-bridge', (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.json({ ok: false, reply: 'Pesan kosong' });
    }
    const text = message.trim();
    clearStalePending();

    // Konfirmasi: jika ada pending belum dikonfirmasi dan pesan ini kata konfirmasi
    if (bridge.pending && !bridge.pending.confirmed && isConfirmation(text)) {
      bridge.pending.confirmed = true;
      const cmd = bridge.pending.command;
      bridge.toLaptop.push({ text: `EXECUTE:${cmd}`, ts: Date.now(), delivered: false });
      console.log(`[BRIDGE] Konfirmasi diterima dari HP. Laptop eksekusi: "${cmd}"`);
      return res.json({
        ok: true,
        reply: `Oke Boss, konfirmasi diterima. Laptop segera eksekusi: "${cmd}". Hasil menyusul lewat polling.`,
        agent: 'JAUN'
      });
    }

    // Perintah baru -> simpan pending, minta konfirmasi
    bridge.pending = { command: text, confirmed: false, ts: Date.now() };
    addMessage('robot', 'user', `/bigone ${text}`);
    console.log(`[BRIDGE] Perintah baru dari HP: "${text}"`);
    res.json({
      ok: true,
      reply: `Siap laksanakan: "${text}".\nKirim 'gas bro' di HP untuk konfirmasi, baru aku eksekusi.`,
      agent: 'JAUN'
    });
  } catch (error) {
    console.error('[BRIDGE Error]:', error.message);
    res.json({ ok: false, reply: `Error: ${error.message}` });
  }
});

// ===== Laptop -> HP (hasil eksekusi) =====
app.post('/jaun-reply', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.json({ ok: false, reply: 'Pesan kosong' });
  }
  bridge.toRobot.push({ text: message.trim(), ts: Date.now(), delivered: false });
  console.log(`[BRIDGE] Hasil dari laptop -> HP: "${message.substring(0, 80)}..."`);
  res.json({ ok: true, reply: 'Hasil terkirim ke HP.' });
});

// ===== Laptop polling: tarik EXECUTE =====
app.get('/jaun-bridge', (req, res) => {
  const pending = bridge.toLaptop.filter(m => !m.delivered);
  pending.forEach(m => { m.delivered = true; });
  res.json({ messages: pending.map(m => ({ text: m.text })) });
});

// ===== HP polling: tarik hasil dari laptop =====
app.post('/jaun-poll', (req, res) => {
  const pending = bridge.toRobot.filter(m => !m.delivered);
  pending.forEach(m => { m.delivered = true; });
  res.json({ messages: pending.map(m => ({ text: m.text })) });
});

// Debug: lihat isi antrian bridge
app.get('/jaun-status', (req, res) => {
  res.json({
    pending: bridge.pending,
    toLaptop: bridge.toLaptop,
    toRobot: bridge.toRobot
  });
});

// ===================== MEMORY ENDPOINTS =====================
app.get('/memory', (req, res) => {
  res.json({
    conversations: Object.keys(memory.conversations).map(src => ({
      source: src,
      messages: memory.conversations[src].length
    })),
    facts: memory.facts.map(f => f.fact)
  });
});

app.delete('/memory', (req, res) => {
  memory.conversations = {};
  memory.facts = [];
  res.json({ ok: true, reply: 'Memory cleared' });
});

// Health + Status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'JAUN Manager API',
    timestamp: new Date().toISOString()
  });
});

app.get('/status', async (req, res) => {
  const ollama = require('./agents/ollama');
  const ollamaOk = await ollama.isAvailable();
  const sources = Object.keys(memory.conversations);

  res.json({
    ollama: ollamaOk ? 'running' : 'offline',
    bigpickle: 'openrouter',
    etsy: 'connected',
    memory: {
      sources,
      totalFacts: memory.facts.length
    }
  });
});

app.listen(PORT, () => {
  console.log(`\nJAUN Manager API running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /jaun       - Chat dengan JAUN (shared memory)`);
  console.log(`  POST /jaun-bridge - Robot kirim perintah ke laptop`);
  console.log(`  GET  /jaun-bridge - Laptop tarik perintah dari robot`);
  console.log(`  POST /jaun-reply  - Laptop kirim balasan ke robot`);
  console.log(`  POST /jaun-poll   - Robot tarik balasan dari laptop`);
  console.log(`  GET  /memory     - Lihat memory`);
  console.log(`  DELETE /memory   - Clear memory`);
  console.log(`  GET  /health     - Health check`);
  console.log(`  GET  /status     - Status system`);
  console.log(`\nSemua interface (Robot, Telegram, Laptop) share memory yang sama.`);
});

// ===================== TELEGRAM BOT (webhook mode) =====================
const TG_TOKEN = process.env.TG_TOKEN;
if (TG_TOKEN) {
  const WEBHOOK_PATH = '/tg/webhook';
  const MAX_LEN = 4000;

  function splitMsg(text) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + MAX_LEN, text.length);
      if (end < text.length) {
        const nl = text.lastIndexOf('\n', end);
        if (nl > start) end = nl;
      }
      chunks.push(text.slice(start, end));
      start = end;
    }
    return chunks;
  }

  async function tgApi(method, body) {
    const resp = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return resp.json();
  }

  // Laptop/HP minta URL download file Telegram (tanpa ekspos token)
  app.post('/tg-getfile', async (req, res) => {
    try {
      const { file_id } = req.body || {};
      if (!file_id) return res.json({ ok: false, reply: 'file_id kosong' });
      const data = await tgApi('getFile', { file_id });
      if (!data.ok) return res.json({ ok: false, reply: data.description || 'Gagal dapat file' });
      res.json({
        ok: true,
        url: `https://api.telegram.org/file/bot${TG_TOKEN}/${data.result.file_path}`,
        file_path: data.result.file_path
      });
    } catch (e) {
      res.json({ ok: false, reply: e.message });
    }
  });

  async function sendReply(chatId, text) {
    if (text.length > MAX_LEN) {
      const parts = splitMsg(text);
      for (let i = 0; i < parts.length; i++) {
        await tgApi('sendMessage', { chat_id: chatId, text: `Part ${i + 1}/${parts.length}:\n${parts[i]}` });
      }
    } else {
      await tgApi('sendMessage', { chat_id: chatId, text });
    }
  }

  async function handleTelegramUpdate(body) {
    const msg = body.message;
    if (!msg) return;
    const chatId = msg.chat.id;
    const text = msg.text;

    // File/document dari Telegram (mis. APK) -> simpan notifikasi untuk laptop
    if (msg.document) {
      const doc = msg.document;
      const fileName = doc.file_name || `file_${Date.now()}`;
      const caption = (msg.caption || '').trim();
      console.log(`[TG FILE] "${fileName}" (${doc.file_size} bytes) dari chat ${chatId}`);
      // Beri tahu laptop lewat antrian hasil eksekusi
      bridge.toRobot.push({
        text: `📦 FILE TERIMA dari Telegram: "${fileName}" (${(doc.file_size / 1024 / 1024).toFixed(1)} MB). file_id=${doc.file_id}. caption: ${caption || '(tanpa caption)'}`,
        ts: Date.now(),
        delivered: false
      });
      await sendReply(chatId, `Oke Boss, aku terima file "${fileName}". Laptop segera menariknya.`);
      return;
    }

    if (text === '/start' || text === '/help') {
      await sendReply(chatId,
        `JAUN Manager\n\n` +
        `Ketik pesan langsung untuk ngobrol.\n` +
        `Pesan dari Telegram, Robot HP, dan Laptop share memory yang sama.\n\n` +
        `Commands: /start /status /memory /help`
      );
      return;
    }
    if (text === '/status') {
      await sendReply(chatId, 'JAUN Manager aktif. Shared memory aktif.');
      return;
    }
    if (text === '/memory') {
      const sources = Object.keys(memory.conversations);
      const total = sources.reduce((a, s) => a + (memory.conversations[s]?.length || 0), 0);
      await sendReply(chatId,
        `Memory:\nSources: ${sources.join(', ') || 'none'}\n` +
        `Total pesan: ${total}\nFakta tersimpan: ${memory.facts.length}`
      );
      return;
    }
    if (!text || text.startsWith('/')) return;

    const source = `telegram-${chatId}`;
    try {
      addMessage(source, 'user', text);
      const parsed = parseCommand(text);

      if (parsed.fact) {
        addFact(parsed.fact);
        addMessage(source, 'jaun', `Oke, aku inget: "${parsed.fact}"`);
        await sendReply(chatId, `Oke Boss, aku simpen: "${parsed.fact}"`);
        return;
      }
      if (parsed.unfact) {
        memory.facts = memory.facts.filter(f => !f.fact.toLowerCase().includes(parsed.unfact.toLowerCase()));
        addMessage(source, 'jaun', `Oke, aku lupa: "${parsed.unfact}"`);
        await sendReply(chatId, `Oke Boss, aku lupa tentang: "${parsed.unfact}"`);
        return;
      }

      const memoryCtx = buildMemoryContext(source);
      const fullMessage = memoryCtx + JAUN_CONTEXT + "\n\nUser dari: telegram\nPertanyaan: " + parsed.message;
      const result = await route(fullMessage, parsed.agent === 'auto' ? null : parsed.agent);

      addMessage(source, 'jaun', result.response);
      await sendReply(chatId, result.response);
    } catch (error) {
      console.error('[TG Error]:', error.message);
      await sendReply(chatId, `Error: ${error.message}`);
    }
  }

  app.post(WEBHOOK_PATH, express.json(), (req, res) => {
    res.sendStatus(200);
    handleTelegramUpdate(req.body).catch(e => console.error('[TG Hook Error]:', e.message));
  });

  async function setupWebhook() {
    try {
      const publicUrl = `https://jaun-api-production.up.railway.app${WEBHOOK_PATH}`;
      const data = await tgApi('setWebhook', { url: publicUrl, drop_pending_updates: true });
      console.log(`Telegram Webhook: ${data.ok ? 'OK' : 'FAILED'} - ${data.description || ''}`);
    } catch (e) {
      console.error('[TG Webhook Setup Error]:', e.message);
    }
  }

  setupWebhook();
  console.log('Telegram Bot aktif via Webhook (shared memory).');
} else {
  console.log('TG_TOKEN tidak diset, Telegram Bot dimatikan.');
}
