require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { route, analyzeTask } = require('./router');
const etsy = require('./integrations/etsy');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const JAUN_CONTEXT = `
[INSTRUKSI] Jawablah SELALALU dalam Bahasa Indonesia yang santai, singkat, dan jelas.
Gunakan [PENGETAHUAN] di bawah saat menjawab pertanyaan.

[PENGETAHUAN]
JAUN 78 adalah asisten pribadi digital berbasis AI. Aplikasinya punya 3 tab:
HUD (status sistem + ringkasan agenda), CHAT (ngobrol dengan AI), dan AGENDA
(manajemen jadwal: tambah, tandai selesai, hapus agenda).
JAUN 78 bisa: mengatur dan mengingatkan agenda harian, menyarankan jadwal
meeting/transport/anggaran harian, dan menjawab pertanyaan umum.
Panggilan nama AI adalah "JAUN".

Kamu juga bisa melakukan coding tasks:
- "code: buatkan fungsi factorial" → akan diproses oleh CODER (7B)
- "debug: fix error di line 42" → akan diproses oleh DEBUGGER (7B)
- "review: cek kode saya" → akan diproses oleh REVIEWER (Big Pickle)
- "quick: apa itu API?" → akan diproses oleh QUICK (3B)

Kamu juga bisa manage Etsy store:
- "etsy:list" → list semua produk
- "etsy:desc [produk]" → generate deskripsi
- "etsy:tags [produk]" → generate SEO tags
- "etsy:reply [pesan]" → draft reply customer
- "etsy:analytics" → analisis penjualan

Gunakan routing yang tepat berdasarkan isi pesan.
`.trim();

// Parse command from message
function parseCommand(message) {
  const lower = message.toLowerCase().trim();
  
  // Explicit agent commands
  if (lower.startsWith('code:')) return { agent: 'coder', message: message.substring(5).trim() };
  if (lower.startsWith('debug:')) return { agent: 'debugger', message: message.substring(6).trim() };
  if (lower.startsWith('review:')) return { agent: 'reviewer', message: message.substring(7).trim() };
  if (lower.startsWith('quick:')) return { agent: 'quick', message: message.substring(6).trim() };
  
  // Etsy commands
  if (lower.startsWith('etsy:list')) return { etsy: 'list' };
  if (lower.startsWith('etsy:stat')) return { etsy: 'stat' };
  if (lower.startsWith('etsy:desc')) return { etsy: 'desc', message: message.substring(9).trim() };
  if (lower.startsWith('etsy:tags')) return { etsy: 'tags', message: message.substring(9).trim() };
  if (lower.startsWith('etsy:reply')) return { etsy: 'reply', message: message.substring(10).trim() };
  if (lower.startsWith('etsy:analytics')) return { etsy: 'analytics' };
  
  // Auto-route
  return { agent: 'auto', message };
}

// Main JAUN endpoint (compatible with Android app)
app.post('/jaun', async (req, res) => {
  try {
    const { message, key } = req.body;
    
    if (!message) {
      return res.json({ ok: false, reply: 'Pesan kosong' });
    }
    
    console.log(`[JAUN] Request: "${message.substring(0, 80)}..."`);
    
    const parsed = parseCommand(message);
    
    // Handle Etsy commands
    if (parsed.etsy) {
      let reply = '';
      
      switch (parsed.etsy) {
        case 'list':
          const listings = await etsy.getListings();
          reply = `📦 Total ${listings.count} produk:\n\n`;
          listings.results?.forEach((l, i) => {
            const price = typeof l.price === 'object' ? `${l.price.amount / 100} ${l.price.currency_code}` : `${l.price}`;
            reply += `${i + 1}. ${l.title} - ${price}\n`;
          });
          break;
          
        case 'stat':
          const stats = await etsy.getListingStats();
          reply = `📊 Total aktif: ${stats.totalActive} produk`;
          break;
          
        case 'desc':
          const descResult = await route(
            `Buatkan deskripsi produk Etsy yang menarik dan SEO-friendly untuk: "${parsed.message}". Deskripsi harus 200-300 kata, include keywords, call to action.`,
            'coder'
          );
          reply = descResult.response;
          break;
          
        case 'tags':
          const tagsResult = await route(
            `Buatkan 13 tags SEO untuk Etsy listing: "${parsed.message}". Format: tag1, tag2, tag3. Maks 20 karakter per tag.`,
            'quick'
          );
          reply = tagsResult.response;
          break;
          
        case 'reply':
          const replyResult = await route(
            `Buatkan balasan profesional dan ramah untuk customer Etsy: "${parsed.message}". Singkat tapi informatif.`,
            'coder'
          );
          reply = replyResult.response;
          break;
          
        case 'analytics':
          const analytics = await etsy.getReceiptsSummary();
          reply = `📈 Analytics:\nTotal orders: ${analytics.totalOrders}\nTotal revenue: $${analytics.totalRevenue.toFixed(2)}`;
          if (analytics.recentOrders.length > 0) {
            reply += `\n\nRecent orders:\n`;
            analytics.recentOrders.forEach((o, i) => {
              reply += `${i + 1}. #${o.id} - $${o.total} (${o.status})\n`;
            });
          }
          break;
      }
      
      return res.json({ ok: true, reply, agent: 'ETSY' });
    }
    
    // Handle AI agent commands
    const fullMessage = JAUN_CONTEXT + "\n\nPertanyaan: " + parsed.message;
    const result = await route(fullMessage, parsed.agent === 'auto' ? null : parsed.agent);
    
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'JAUN Manager API',
    timestamp: new Date().toISOString() 
  });
});

// Status endpoint
app.get('/status', async (req, res) => {
  const ollama = require('./agents/ollama');
  const ollamaOk = await ollama.isAvailable();
  
  res.json({
    ollama: ollamaOk ? 'running' : 'offline',
    models: ['qwen2.5-coder:3b', 'qwen2.5-coder:7b'],
    bigpickle: 'cloud',
    etsy: 'connected'
  });
});

app.listen(PORT, () => {
  console.log(`\n🤖 JAUN Manager API berjalan di port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /jaun      - Chat dengan JAUN`);
  console.log(`  GET  /health    - Health check`);
  console.log(`  GET  /status    - Status system`);
  console.log(`\nGunakan endpoint ini di Android app JAUN 78`);
});
