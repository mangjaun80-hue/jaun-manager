const quick = require('./agents/quick');
const coder = require('./agents/coder');
const debugger_ = require('./agents/debugger');
const reviewer = require('./agents/reviewer');

const agents = {
  quick,
  coder,
  debugger: debugger_,
  reviewer
};

const KEYWORDS = {
  quick: ['apa itu', 'gimana cara', 'jelaskan', 'definisi', 'pengertian', 'contoh', 'maksudnya', 'kenapa', 'bedanya', 'singkat'],
  coder: ['buatkan', 'bikin', 'buat', 'kode', 'function', 'class', 'script', 'program', 'implementasi', 'tulis kode', 'coding', 'create', 'write', 'build', 'develop'],
  debugger: ['error', 'bug', 'fix', 'perbaiki', 'tidak jalan', 'gagal', 'crash', 'eror', 'debug', 'troubleshoot', 'masalah', 'issue', 'problem'],
  reviewer: ['review', 'cek kode', 'tinjau', 'evaluasi', 'kualitas', 'лучше', 'optimal', 'apakah benar', 'validasi', 'test']
};

function analyzeTask(message) {
  const lower = message.toLowerCase();
  
  const scores = {
    quick: 0,
    coder: 0,
    debugger: 0,
    reviewer: 0
  };
  
  for (const [agent, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        scores[agent] += 1;
      }
    }
  }
  
  if (lower.includes('?') && !lower.includes('fix') && !lower.includes('error')) {
    scores.quick += 2;
  }
  
  if (lower.includes('```') || lower.includes('def ') || lower.includes('function ') || lower.includes('class ')) {
    scores.debugger += 2;
    scores.reviewer += 1;
  }
  
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) {
    return 'quick';
  }
  
  const winner = Object.entries(scores).find(([, score]) => score === maxScore)[0];
  return winner;
}

async function route(userMessage, forceAgent = null, fullMessage = null) {
  let agentName = forceAgent || analyzeTask(userMessage);
  const agent = agents[agentName];
  
  if (!agent) {
    throw new Error(`Agent '${agentName}' tidak ditemukan`);
  }
  
  console.log(`[Router] "${userMessage.substring(0, 50)}..." → Agent: ${agent.name}`);
  
  const response = await agent.run(fullMessage || userMessage);
  
  return {
    agent: agent.name,
    response
  };
}

async function routeStream(message, onChunk, forceAgent = null) {
  let agentName = forceAgent || analyzeTask(message);
  const agent = agents[agentName];
  
  if (!agent) {
    throw new Error(`Agent '${agentName}' tidak ditemukan`);
  }
  
  console.log(`[Router] Task: "${message.substring(0, 50)}..." → Agent: ${agent.name}`);
  
  const response = await agent.runStream(message, onChunk);
  
  return {
    agent: agent.name,
    response
  };
}

function getAgentInfo() {
  return Object.entries(agents).map(([key, agent]) => ({
    key,
    name: agent.name
  }));
}

module.exports = { route, routeStream, analyzeTask, getAgentInfo };
