require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { route, routeStream, getAgentInfo } = require('./router');
const etsy = require('./integrations/etsy');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BOT_TOKEN = process.env.TG_TOKEN;
const ALLOWED_CHAT_IDS = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.split(',').map(id => id.trim()) || [];
const MAX_MESSAGE_LENGTH = 4000;

// Voice mode tracking
const voiceMode = new Set();

if (!BOT_TOKEN) {
  console.error('❌ TG_TOKEN harus diisi di file .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🤖 JAUN Manager Bot dimulai!');

function isAuthorized(chatId) {
  if (ALLOWED_CHAT_IDS.length === 0) return true;
  return ALLOWED_CHAT_IDS.includes(chatId.toString());
}

function splitMessage(text, maxLength) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxLength;
    if (end >= text.length) {
      end = text.length;
    } else {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start) {
        end = lastNewline;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  
  return chunks;
}

function textToSpeech(text) {
  const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.ogg`);
  const cleanText = text.replace(/[*_`#\[\]]/g, '').replace(/\n+/g, '. ').slice(0, 3000);
  try {
    execSync(`python tts.py "${cleanText.replace(/"/g, '\\"')}" "${tmpFile}"`, { timeout: 30000 });
    return tmpFile;
  } catch (e) {
    console.error('TTS error:', e.message);
    return null;
  }
}

async function sendVoiceMessage(chatId, text) {
  const tmpFile = textToSpeech(text);
  if (tmpFile && fs.existsSync(tmpFile)) {
    try {
      await bot.sendVoice(chatId, tmpFile);
      fs.unlinkSync(tmpFile);
      return true;
    } catch (e) {
      console.error('Send voice error:', e.message);
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }
  return false;
}

async function sendMessage(chatId, text, parseMode = 'Markdown') {
  if (text.length > MAX_MESSAGE_LENGTH) {
    const chunks = splitMessage(text, MAX_MESSAGE_LENGTH);
    for (let i = 0; i < chunks.length; i++) {
      await bot.sendMessage(chatId, `📝 *Part ${i + 1}/${chunks.length}:*\n\`\`\`\n${chunks[i]}\n\`\`\``, { parse_mode: parseMode });
    }
  } else {
    await bot.sendMessage(chatId, text, { parse_mode: parseMode });
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return bot.sendMessage(chatId, '❌ Akses ditolak.');
  
  bot.sendMessage(chatId,
    `🤖 *JAUN Manager*\n\n` +
    `AI Team untuk coding, debugging, review & Etsy management.\n\n` +
    `*Coding Agents:*\n` +
    `/quick <pesan> - Task ringan (3B)\n` +
    `/code <pesan> - Nulis kode (7B)\n` +
    `/debug <pesan> - Fix bug (7B)\n` +
    `/review <pesan> - Review kode (Big Pickle)\n` +
    `/auto <pesan> - Auto-route\n\n` +
    `*Etsy Management:*\n` +
    `/etsy_list - List produk\n` +
    `/etsy_stat - Statistik toko\n` +
    `/etsy_desc <judul> - Generate deskripsi\n` +
    `/etsy_tags <judul> - Generate SEO tags\n` +
    `/etsy_reply <pesan> - Draft reply customer\n` +
    `/etsy_analytics - Analisis penjualan\n\n` +
    `*Utilities:*\n` +
    `/status - Status system\n` +
    `/agents - List agents\n` +
    `/help - Bantuan`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/quick (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '⏳ [QUICK] Memproses...');
  try {
    const result = await route(match[1], 'quick');
    await sendMessage(chatId, `✅ *[QUICK]:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/code (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '⏳ [CODER] Memproses...');
  try {
    const result = await route(match[1], 'coder');
    await sendMessage(chatId, `✅ *[CODER]:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/debug (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '⏳ [DEBUGGER] Memproses...');
  try {
    const result = await route(match[1], 'debugger');
    await sendMessage(chatId, `✅ *[DEBUGGER]:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/review (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '⏳ [REVIEWER] Memproses...');
  try {
    const result = await route(match[1], 'reviewer');
    await sendMessage(chatId, `✅ *[REVIEWER]:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/auto (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '⏳ [AUTO] Menganalisis...');
  try {
    const result = await route(match[1]);
    await sendMessage(chatId, `✅ *[${result.agent}]:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/etsy_list/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '📦 Mengambil listing...');
  try {
    const listings = await etsy.getListings();
    let text = `📦 *Listings (${listings.count} produk):*\n\n`;
      listings.results?.forEach((l, i) => {
        const price = typeof l.price === 'object' ? `${l.price.amount / 100} ${l.price.currency_code}` : `${l.price} ${l.currency_code || ''}`;
        text += `${i + 1}. ${l.title}\n   💰 ${price}\n\n`;
      });
    await sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/etsy_stat/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '📊 Mengambil statistik...');
  try {
    const stats = await etsy.getListingStats();
    await bot.sendMessage(chatId, 
      `📊 *Statistik Toko:*\n\n` +
      `Total aktif: *${stats.totalActive}* produk`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/etsy_desc (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '📝 Generating deskripsi...');
  try {
    const result = await route(
      `Buatkan deskripsi produk Etsy yang menarik dan SEO-friendly untuk: "${match[1]}". 
       Deskripsi harus 200-300 kata, include keywords, call to action.`,
      'coder'
    );
    await sendMessage(chatId, `✅ *Deskripsi:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/etsy_tags (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '🏷️ Generating tags...');
  try {
    const result = await route(
      `Buatkan 13 tags SEO untuk Etsy listing: "${match[1]}". 
       Format: tag1, tag2, tag3, ... Maks 20 karakter per tag.`,
      'quick'
    );
    await sendMessage(chatId, `✅ *Tags:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/etsy_reply (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '💬 Drafting reply...');
  try {
    const result = await route(
      `Buatkan balasan profesional dan ramah untuk customer Etsy: "${match[1]}". 
       Singkat tapi informatif.`,
      'coder'
    );
    await sendMessage(chatId, `✅ *Reply:*\n${result.response}`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/etsy_analytics/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  await bot.sendMessage(chatId, '📈 Mengambil analytics...');
  try {
    const analytics = await etsy.getReceiptsSummary();
    let text = `📈 *Analytics Toko:*\n\n`;
    text += `Total orders: *${analytics.totalOrders}*\n`;
    text += `Total revenue: *$${analytics.totalRevenue.toFixed(2)}*\n\n`;
    
    if (analytics.recentOrders.length > 0) {
      text += `*Recent orders:*\n`;
      analytics.recentOrders.forEach((o, i) => {
        text += `${i + 1}. #${o.id} - $${o.total} (${o.status})\n`;
      });
    }
    
    await sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  const ollama = require('./agents/ollama');
  const ollamaOk = await ollama.isAvailable();
  
  await bot.sendMessage(chatId,
    `📊 *Status:*\n\n` +
    `Ollama: ${ollamaOk ? '✅ Running' : '❌ Offline'}\n` +
    `Model 3B: qwen2.5-coder:3b\n` +
    `Model 7B: qwen2.5-coder:7b\n` +
    `Big Pickle: ✅ Cloud`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/agents/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  let text = `🤖 *Agents:*\n\n`;
  getAgentInfo().forEach(a => {
    text += `• ${a.key} → ${a.name}\n`;
  });
  
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  bot.sendMessage(chatId,
    `📖 *Bantuan:*\n\n` +
    `Ketik /start untuk melihat semua command.\n\n` +
    `🎤 *Voice Mode:*\n` +
    `/voice - Aktifkan mode suara\n` +
    `/stop - Matikan mode suara`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/voice/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  voiceMode.add(chatId);
  await bot.sendMessage(chatId, '🎤 *Voice Mode AKTIF!*\n\nSemua jawaban akan dikirim sebagai voice message.\nKetik /stop untuk matikan.', { parse_mode: 'Markdown' });
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAuthorized(chatId)) return;
  
  voiceMode.delete(chatId);
  await bot.sendMessage(chatId, '🔇 *Voice Mode DIMATIKAN!*\n\nJawaban kembali teks biasa.', { parse_mode: 'Markdown' });
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.text?.startsWith('/')) return;
  
  if (!isAuthorized(chatId)) return;
  
  if (!msg.text) return;
  
  await bot.sendMessage(chatId, '⏳ Memproses...');
  try {
    const result = await route(msg.text);
    const reply = `✅ *[${result.agent}]:*\n${result.response}`;
    
    if (voiceMode.has(chatId)) {
      const sent = await sendVoiceMessage(chatId, result.response);
      if (!sent) {
        await sendMessage(chatId, reply);
      }
    } else {
      await sendMessage(chatId, reply);
    }
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code);
});

console.log('✅ JAUN Manager Bot berjalan. Tekan Ctrl+C untuk berhenti.');
