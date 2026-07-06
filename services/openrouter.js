const axios = require('axios');
const BASE = 'https://openrouter.ai/api/v1';
const rotation = require('./rotation');
const getKey = () => rotation.getOpenrouterKey() || process.env.OPENROUTER_API_KEY;
const { FREE_MODELS: SEED_FREE } = require('./model_catalog');
let _cache = { all: [], free: SEED_FREE, ts: 0 };
const CACHE_TTL = 6*60*60*1000;
const HEADERS = () => ({
  'Authorization': `Bearer ${getKey()}`,
  'HTTP-Referer': 'https://github.com/yuvrajlaptop2008-byte/ai-dev-agent',
  'X-Title': 'AI Dev Agent'
});

const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const FALLBACK_CHAIN = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-235b-a22b:free',
  'mistralai/mistral-small-3.1-24b-instruct:free'
];

const MODEL_PRESETS = {
  '🆓 llama-3.3-70b':   'meta-llama/llama-3.3-70b-instruct:free',
  '🆓 deepseek-v3':     'deepseek/deepseek-chat-v3-0324:free',
  '🆓 qwen3-235b':      'qwen/qwen3-235b-a22b:free',
  '🆓 qwen-2.5-72b':    'qwen/qwen-2.5-72b-instruct:free',
  '🆓 qwen-2.5-coder':  'qwen/qwen-2.5-coder-32b-instruct:free',
  '🆓 gemma-3-27b':     'google/gemma-3-27b-it:free',
  '🆓 phi-4':           'microsoft/phi-4:free',
  '🆓 qwq-32b':         'qwen/qwq-32b:free',
  '🆓 llama-4-maverick':'meta-llama/llama-4-maverick:free',
  '🆓 mistral-small':   'mistralai/mistral-small-3.1-24b-instruct:free',
};

const POOL = FALLBACK_CHAIN;
let _poolIdx = 0;
function nextPoolModel() { const m = POOL[_poolIdx % POOL.length]; _poolIdx++; return m; }

function selectModel(task) {
  const t = (task || '').toLowerCase();
  if (t.includes('code') || t.includes('bug') || t.includes('fix') || t.includes('implement')) return 'qwen/qwen-2.5-coder-32b-instruct:free';
  if (t.includes('reason') || t.includes('complex') || t.includes('analyze')) return 'qwen/qwen3-235b-a22b:free';
  return nextPoolModel();
}

async function getModels(force) {
  if (!force && _cache.all.length && Date.now() - _cache.ts < CACHE_TTL) return _cache.all;
  try {
    const r = await axios.get(`${BASE}/models`, { headers: HEADERS(), timeout: 12000 });
    const list = r.data.data.filter(m => m.id.includes(':free') || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0)).sort((a,b) => a.id > b.id ? 1 : -1);
    const free = list.map(m => m.id);
    _cache = { all: list, free: free.length ? free : SEED_FREE, ts: Date.now() };
    return list;
  } catch {
    return _cache.all.length ? _cache.all : [];
  }
}
function getFreeModels() { return _cache.free.length ? _cache.free : SEED_FREE; }
function getCacheInfo() { return { count: _cache.all.length, freeCount: getFreeModels().length, lastRefresh: _cache.ts ? new Date(_cache.ts).toISOString() : null }; }

function normalizeModel(model) {
  const BLOCKED = ['anthropic/', 'openai/', 'mistralai/codestral', 'deepseek/deepseek-coder-v2', 'x-ai/', 'cohere/', 'perplexity/', 'deepseek/deepseek-r1', 'google/gemini-2.0-flash'];
  if (!model || BLOCKED.some(b => model.startsWith(b))) return DEFAULT_MODEL;
  return model;
}

async function chat(messages, model, tools, systemPrompt, opts = {}) {
  model = normalizeModel(model);
  const sysMsg = systemPrompt ? { role: 'system', content: systemPrompt } : null;
  const msgs = sysMsg ? [sysMsg, ...messages] : messages;
  const body = { model, messages: msgs, max_tokens: opts.max_tokens || 8000, temperature: opts.temperature ?? 0.2 };
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
  try {
    const r = await axios.post(`${BASE}/chat/completions`, body, { headers: HEADERS(), timeout: 120000 });
    return r.data;
  } catch (e) {
    const status = e.response?.status;
    if ((status === 401 || status === 429) && rotation.status().openrouterKeys > 1 && !opts._keyRotated) {
      rotation.rotateOpenrouter();
      return chat(messages, model, tools, systemPrompt, { ...opts, _keyRotated: true });
    }
    if ((status === 404 || status === 429 || status === 502 || status === 503) && !opts._retried) {
      for (const fb of FALLBACK_CHAIN) {
        if (fb === model) continue;
        try { return await chat(messages, fb, tools, systemPrompt, { ...opts, _retried: true }); } catch {}
      }
    }
    throw e;
  }
}

async function streamChat(data, onChunk, onDone, onError) {
  const { messages, systemPrompt, tools } = data;
  let model = normalizeModel(data.model);
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const body = { model, messages: msgs, stream: true, max_tokens: 8000, temperature: 0.2 };
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }

  const attempt = async (mdl, isRetry) => {
    body.model = mdl;
    try {
      const r = await axios.post(`${BASE}/chat/completions`, body, { headers: HEADERS(), responseType: 'stream', timeout: 120000 });
      let buf = '', tcs = [];
      r.data.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const ln of lines) {
          if (!ln.startsWith('data: ') || ln === 'data: [DONE]') continue;
          try {
            const j = JSON.parse(ln.slice(6)), delta = j.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) onChunk({ type: 'text', content: delta.content });
            if (delta.tool_calls) for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!tcs[tc.index]) tcs[tc.index] = { id:'', type:'function', function:{name:'',arguments:''} };
                if (tc.id) tcs[tc.index].id = tc.id;
                if (tc.function?.name) tcs[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) tcs[tc.index].function.arguments += tc.function.arguments;
              }
            }
          } catch {}
        }
      });
      r.data.on('end', () => onDone({ toolCalls: tcs.length ? tcs : null }));
      r.data.on('error', (e) => { if (!isRetry) attempt(FALLBACK_CHAIN.find(f => f !== mdl), true); else onError(e); });
    } catch (e) {
      const status = e.response?.status;
      if (!isRetry && (status === 404 || status === 429 || status === 502 || status === 503)) {
        return attempt(FALLBACK_CHAIN.find(f => f !== mdl) || DEFAULT_MODEL, true);
      }
      if (onError) onError(e); else console.error(e);
    }
  };
  await attempt(model, false);
}

module.exports = { chat, streamChat, getModels, getFreeModels, getCacheInfo, MODEL_PRESETS, FREE_MODELS: SEED_FREE, selectModel, rotation, DEFAULT_MODEL };
