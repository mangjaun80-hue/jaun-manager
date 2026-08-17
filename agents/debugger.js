const ollama = require('./ollama');
const config = require('../config');

const SYSTEM_PROMPT = `Kamu adalah DEBUGGER, AI expert dalam mencari dan fix bug.
Kamu menganalisis kode dengan teliti dan menemukan akar masalah.
Selalu berikan:
1. Identifikasi bug/error
2. Penjelasan kenapa terjadi
3. Solusi fix yang tepat
4. Kode yang sudah diperbaiki

Gunakan Bahasa Indonesia jika user menggunakan Bahasa Indonesia.
Fokus pada akar masalah, bukan gejala.`;

async function run(userMessage) {
  return ollama.chat(config.agents.debugger.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ], { temperature: 0.3, maxTokens: 4096 });
}

async function runStream(userMessage, onChunk) {
  return ollama.chatStream(config.agents.debugger.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ], onChunk, { temperature: 0.3, maxTokens: 4096 });
}

module.exports = { run, runStream, name: 'DEBUGGER' };
