const OpenAI = require('openai');
const config = require('../config');

let _ollamaAvailable = null;

function createOllamaClient() {
  return new OpenAI({
    baseURL: `${config.ollama.baseUrl}/v1`,
    apiKey: 'ollama'
  });
}

function createBigPickleClient() {
  return new OpenAI({
    baseURL: config.bigpickle.baseUrl,
    apiKey: config.bigpickle.apiKey
  });
}

async function isAvailable() {
  if (_ollamaAvailable !== null) return _ollamaAvailable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${config.ollama.baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    _ollamaAvailable = response.ok;
  } catch {
    _ollamaAvailable = false;
  }
  console.log(`[Ollama] ${_ollamaAvailable ? '✅ Available' : '❌ Offline - using Big Pickle cloud'}`);
  return _ollamaAvailable;
}

async function chat(model, messages, options = {}) {
  const ollamaOk = await isAvailable();
  
  if (ollamaOk) {
    try {
      const client = createOllamaClient();
      const response = await client.chat.completions.create({
        model,
        messages,
        stream: false,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`[Ollama Error] Falling back to Big Pickle:`, error.message);
    }
  }

  // Fallback to Big Pickle (OpenRouter) with rate-limit retry + backoff
  const client = createBigPickleClient();
  const maxRetries = options.maxRetries || 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Big Pickle] Using cloud for: ${model} (attempt ${attempt}/${maxRetries})`);
      const response = await client.chat.completions.create({
        model: config.bigpickle.model,
        messages,
        stream: false,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      });
      return response.choices[0].message.content;
    } catch (error) {
      lastErr = error;
      const isRateLimit = /429|rate limit|rate_limit|too many/i.test(String(error.message));
      console.log(`[Big Pickle Error] ${error.message}`);
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = options.retryDelayMs || 6000 * Math.pow(2, attempt - 1);
        console.log(`[Big Pickle] Rate limited. Retry in ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      break;
    }
  }
  if (lastErr && /429|rate limit|rate_limit|too many/i.test(String(lastErr.message))) {
    return 'Maaf Boss, kuota AI lagi kepake penuh. Tunggu beberapa menit, lalu coba lagi ya.';
  }
  throw lastErr || new Error('Big Pickle gagal');
}

async function chatStream(model, messages, onChunk, options = {}) {
  const ollamaOk = await isAvailable();
  
  if (ollamaOk) {
    try {
      const client = createOllamaClient();
      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
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
      console.error(`[Ollama Stream Error] Falling back to Big Pickle:`, error.message);
    }
  }

  // Fallback to Big Pickle
  console.log(`[Big Pickle Stream] Using cloud for: ${model}`);
  const client = createBigPickleClient();
  const stream = await client.chat.completions.create({
    model: config.bigpickle.model,
    messages,
    stream: true,
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 4096
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
}

module.exports = { chat, chatStream, isAvailable };
