const ollama = require('./ollama');
const config = require('../config');

const SYSTEM_PROMPT = `Kamu adalah CODER, AI coding assistant yang ahli menulis kode.
Kamu menulis kode yang bersih, efisien, dan well-documented.
Selalu berikan:
1. Kode yang siap pakai
2. Penjelasan singkat cara pakai
3. Contoh penggunaan jika perlu

Gunakan Bahasa Indonesia jika user menggunakan Bahasa Indonesia.
Fokus pada kualitas kode, bukan panjang penjelasan.`;

async function run(userMessage) {
  return ollama.chat(config.agents.coder.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ], { temperature: 0.3, maxTokens: 4096 });
}

async function runStream(userMessage, onChunk) {
  return ollama.chatStream(config.agents.coder.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ], onChunk, { temperature: 0.3, maxTokens: 4096 });
}

module.exports = { run, runStream, name: 'CODER' };
