require('dotenv').config();

const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    models: {
      quick: 'qwen2.5-coder:3b',
      coder: 'qwen2.5-coder:7b',
      debugger: 'qwen2.5-coder:7b'
    }
  },
  bigpickle: {
    apiKey: process.env.TEAM_KEY || '',
    baseUrl: 'https://opencode.ai/zen/v1',
    model: process.env.OPENCODE_MODEL || 'big-pickle'
  },
  etsy: {
    keystring: process.env.ETSY_KEYSTRING || '',
    secret: process.env.ETSY_SECRET || '',
    shopId: process.env.ETSY_SHOP_ID || '',
    tokenJson: (() => {
      try {
        return JSON.parse(process.env.ETSY_TOKEN_JSON || '{}');
      } catch {
        return {};
      }
    })(),
    baseUrl: 'https://openapi.etsy.com/v3'
  },
  telegram: {
    token: process.env.TG_TOKEN || '',
    allowedIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS?.split(',').map(id => id.trim()) || []
  },
  agents: {
    quick: { name: 'QUICK', model: 'qwen2.5-coder:3b', desc: 'Task ringan, tanya jawab cepat' },
    coder: { name: 'CODER', model: 'qwen2.5-coder:7b', desc: 'Nulis kode, implementasi' },
    debugger: { name: 'DEBUGGER', model: 'qwen2.5-coder:7b', desc: 'Cari & fix bug' },
    reviewer: { name: 'REVIEWER', model: 'big-pickle', desc: 'Review kode, kualitas tinggi' }
  }
};

module.exports = config;
