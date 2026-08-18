// AI Worker queue: laptop (desktop app) menjalankan Ollama lokal, server menunggu jawabannya.
const tasks = new Map();
let nextId = 1;
let lastHeartbeat = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Server side: buat task, tunggu laptop menjawab (timeout -> null untuk fallback cloud)
async function requestAnswer(model, messages, options = {}) {
  const id = nextId++;
  tasks.set(id, { id, model, messages, status: 'pending', answer: null, ts: Date.now() });
  const timeoutMs = options.workerTimeoutMs || 60000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const t = tasks.get(id);
    if (!t) return null;
    if (t.status === 'done') { tasks.delete(id); return t.answer; }
    if (t.status === 'error') { tasks.delete(id); return null; }
    await sleep(1000);
  }
  tasks.delete(id);
  return null;
}

// Laptop: tarik task pending
function pullTask() {
  for (const t of tasks.values()) {
    if (t.status === 'pending') {
      t.status = 'running';
      return { id: t.id, model: t.model, messages: t.messages };
    }
  }
  return null;
}

// Laptop: kirim jawaban
function submitAnswer(id, answer) {
  const t = tasks.get(id);
  if (!t) return;
  if (answer === null || answer === undefined) { t.status = 'error'; return; }
  t.status = 'done';
  t.answer = answer;
}

// Laptop polling = heartbeat; worker dianggap aktif jika < 60 detik terakhir
function heartbeat() { lastHeartbeat = Date.now(); }

function isWorkerActive() { return Date.now() - lastHeartbeat < 60000; }

module.exports = { requestAnswer, pullTask, submitAnswer, heartbeat, isWorkerActive };