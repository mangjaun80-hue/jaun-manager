const OpenAI = require('openai');
const config = require('../config');

function createBigPickleClient() {
  return new OpenAI({
    baseURL: config.bigpickle.baseUrl,
    apiKey: config.bigpickle.apiKey
  });
}

async function run(userMessage) {
  const client = createBigPickleClient();
  
  try {
    const response = await client.chat.completions.create({
      model: config.bigpickle.model,
      messages: [
        { 
          role: 'system', 
          content: `Kamu adalah REVIEWER, AI expert dalam code review dan quality assurance.
Kamu meninjau kode dengan kritis tapi konstruktif.
Selalu berikan:
1. Penilaian kualitas kode (1-10)
2. Issue yang ditemukan (kritikal, warning, suggestion)
3. Best practice yang bisa diperbaiki
4. Kode review yang sudah diperbaiki jika perlu

Gunakan Bahasa Indonesia jika user menggunakan Bahasa Indonesia.` 
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 4096
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('[Big Pickle Error]:', error.message);
    throw error;
  }
}

async function runStream(userMessage, onChunk) {
  const client = createBigPickleClient();
  
  try {
    const stream = await client.chat.completions.create({
      model: config.bigpickle.model,
      messages: [
        { 
          role: 'system', 
          content: `Kamu adalah REVIEWER, AI expert dalam code review dan quality assurance.
Kamu meninjau kode dengan kritis tapi konstruktif.
Selalu berikan:
1. Penilaian kualitas kode (1-10)
2. Issue yang ditemukan (kritikal, warning, suggestion)
3. Best practice yang bisa diperbaiki
4. Kode review yang sudah diperbaiki jika perlu

Gunakan Bahasa Indonesia jika user menggunakan Bahasa Indonesia.` 
        },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 4096
    });
    
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        if (onChunk) onChunk(content);
      }
    }
    
    return fullResponse;
  } catch (error) {
    console.error('[Big Pickle Stream Error]:', error.message);
    throw error;
  }
}

module.exports = { run, runStream, name: 'REVIEWER' };
