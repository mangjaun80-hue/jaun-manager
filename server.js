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
Kamu punya memory yang nyambung dari semua interface (Robot/HP, Telegram, Laptop).
Ingat semua percakapan user di mana pun terjadi. Sebut user "Mang Jaun" atau "Boss".

[PENGETAHUAN]
JAUN 78 adalah aplikasi asisten pribadi digital berbasis AI.
Fitur: HUD (status), CHAT (ngobrol AI), AGENDA (jadwal), SUARA (TTS/STT).
Kamu bisa bantu: agenda, jadwal, coding, debug, review, manage Etsy store.

[COMMANDS]
- "code: ..." → Coding task (CODER agent)
- "debug: ..." → Debug task (DEBUGGER agent)
- "review: ..." → Code review (REVIEWER agent)
- "quick: ..." → Quick question (QUICK agent)
- "etsy:list/desc/tags/reply/analytics" → Etsy store commands
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
    const result = await route(fullMessage, parsed.agent === 'auto' ? null : parsed.agent);

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
