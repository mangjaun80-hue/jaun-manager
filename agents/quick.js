const ollama = require('./ollama');
const config = require('../config');

const SYSTEM_PROMPT = `Kamu adalah QUICK, asisten AI yang cepat dan ringan. 
Kamu menjawab pertanyaan dengan singkat, jelas, dan langsung ke inti.
Gunakan Bahasa Indonesia jika user menggunakan Bahasa Indonesia.
Jawaban maksimal 3-5 kalimat kecuali diminta lebih detail.`;

async function run(userMessage) {
  return ollama.chat(config.agents.quick.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ], { temperature: 0.5, maxTokens: 1024 });
}

async function runStream(userMessage, onChunk) {
  return ollama.chatStream(config.agents.quick.model, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ], onChunk, { temperature: 0.5, maxTokens: 1024 });
}

module.exports = { run, runStream, name: 'QUICK' };
