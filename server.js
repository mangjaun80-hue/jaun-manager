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
  const recent = hist.slice(-20);
  const facts = memory.facts.slice(-10);

  let ctx = '';
  if (facts.length > 0) {
    ctx += '[INGATAN FAKTA]\n' + facts.map(f => `- ${f.fact}`).join('\n') + '\n\n';
  }
  if (recent.length > 0) {
    ctx += '[RIWAYAT PERCAKAPAN TERAKHIR]\n' + recent.map(m => `${m.role}: ${m.text}`).join('\n') + '\n\n';
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

Kamu punya memory yang nyambung dari semua interface (Robot/HP, Telegram, Laptop).
Ingat semua percakapan user di mana pun terjadi. Sebut user "Mang Jaun" atau "Boss".

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
