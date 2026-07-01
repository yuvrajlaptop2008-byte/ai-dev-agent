const axios = require('axios');
const BASE = 'https://openrouter.ai/api/v1';
const getKey = () => process.env.OPENROUTER_API_KEY;
const HEADERS = () => ({
  'Authorization': `Bearer ${getKey()}`,
  'HTTP-Referer': 'https://github.com/yuvrajlaptop2008-byte/ai-dev-agent',
  'X-Title': 'AI Dev Agent'
});

// ── ALL FREE MODELS (65) ─────────────────────────────────
const FREE_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "meta-llama/llama-3.2-1b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-4-scout:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemma-2-9b-it:free",
  "google/gemma-3-1b-it:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-3n-e2b-it:free",
  "google/gemma-3n-e4b-it:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.5-pro-exp-03-25:free",
  "mistralai/mistral-7b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  "microsoft/phi-4:free",
  "microsoft/phi-4-multimodal-instruct:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/phi-4-reasoning-plus:free",
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-r1-zero:free",
  "deepseek/deepseek-v3-base:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-prover-v2:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "qwen/qwen3-0.6b:free",
  "qwen/qwen3-1.7b:free",
  "qwen/qwen3-4b:free",
  "qwen/qwen3-8b:free",
  "qwen/qwen3-14b:free",
  "qwen/qwen3-30b-a3b:free",
  "qwen/qwen3-32b:free",
  "qwen/qwen3-235b-a22b:free",
  "qwen/qwq-32b:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "nvidia/llama-3.1-nemotron-nano-8b-v1:free",
  "nvidia/llama-3.3-nemotron-super-49b-v1:free",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
  "thudm/glm-4-9b-chat:free",
  "thudm/glm-z1-32b:free",
  "thudm/glm-z1-rumination-32b:free",
  "thudm/glm-4-32b:free",
  "nousresearch/hermes-3-llama-3.1-8b:free",
  "nousresearch/deephermes-3-mistral-24b-preview:free",
  "bytedance-research/ui-tars-72b:free",
  "moonshotai/kimi-vl-a3b-thinking:free",
  "open-r1/olympiccoder-32b:free",
  "arliai/qwq-32b-arliai-rpr-v1:free",
  "featherless/qwerky-72b:free",
  "tngtech/deepseek-r1t-chimera:free",
  "sarvamai/sarvam-m:free",
  "rekaai/reka-flash-3:free",
  "mistralai/devstral-small-2505:free",
  "agentica-org/deepcoder-14b-preview:free",
  "shisa-ai/shisa-v2-llama3.3-70b:free",
  "opengvlab/internvl3-14b:free",
  "opengvlab/internvl3-2b:free",
  "openrouter/optimus-alpha:free"
];

// ── PRESET GROUPS ────────────────────────────────────────
const MODEL_PRESETS = {
  '⚡ claude-3.5-sonnet':   'anthropic/claude-3.5-sonnet',
  '🔥 claude-3-opus':       'anthropic/claude-3-opus',
  '💡 gpt-4o':              'openai/gpt-4o',
  '🚀 gpt-4o-mini':         'openai/gpt-4o-mini',
  '💎 gemini-pro-1.5':      'google/gemini-pro-1.5',
  '🆓 deepseek-r1-free':    'deepseek/deepseek-r1:free',
  '🆓 llama-3.3-70b-free':  'meta-llama/llama-3.3-70b-instruct:free',
  '🆓 qwen3-235b-free':     'qwen/qwen3-235b-a22b:free',
  '🆓 gemini-2.0-flash':    'google/gemini-2.0-flash-exp:free',
  '🆓 gemma-3-27b-free':    'google/gemma-3-27b-it:free',
  '🆓 deepseek-v3-free':    'deepseek/deepseek-chat-v3-0324:free',
  '🆓 phi-4-free':          'microsoft/phi-4:free',
  '🆓 qwq-32b-free':        'qwen/qwq-32b:free',
  '🔵 codestral':           'mistralai/codestral-latest',
  '🔵 deepseek-coder-v2':   'deepseek/deepseek-coder-v2',
  '🔵 qwen-2.5-coder':      'qwen/qwen-2.5-coder-32b-instruct',
  '⚡ claude-3-haiku':      'anthropic/claude-3-haiku',
  '🔥 llama-3.1-405b':      'meta-llama/llama-3.1-405b-instruct',
};

// Smart auto-select model by task type
function selectModel(task) {
  const t = task.toLowerCase();
  if (t.includes('code') || t.includes('bug') || t.includes('fix') || t.includes('implement')) return 'deepseek/deepseek-r1:free';
  if (t.includes('reason') || t.includes('complex') || t.includes('analyze')) return 'qwen/qwen3-235b-a22b:free';
  if (t.includes('fast') || t.includes('quick') || t.includes('simple')) return 'meta-llama/llama-3.3-70b-instruct:free';
  return process.env.DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet';
}

async function getModels() {
  try {
    const r = await axios.get(`${BASE}/models`, { headers: HEADERS(), timeout: 12000 });
    return r.data.data.sort((a,b) => a.id > b.id ? 1 : -1);
  } catch { return []; }
}

async function chat(messages, model, tools, systemPrompt, opts = {}) {
  model = model || 'anthropic/claude-3.5-sonnet';
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const body = { model, messages: msgs, max_tokens: opts.max_tokens || 16000, temperature: opts.temperature ?? 0.1 };
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
  const r = await axios.post(`${BASE}/chat/completions`, body, { headers: HEADERS(), timeout: 120000 });
  return r.data;
}

async function streamChat(data, onChunk, onDone, onError) {
  const { messages, model, systemPrompt, tools } = data;
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const body = { model: model || 'anthropic/claude-3.5-sonnet', messages: msgs, stream: true, max_tokens: 16000, temperature: 0.1 };
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
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
    r.data.on('error', onError || console.error);
  } catch (e) { if (onError) onError(e); else throw e; }
}

module.exports = { chat, streamChat, getModels, MODEL_PRESETS, FREE_MODELS, selectModel };
