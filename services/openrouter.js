const axios = require('axios');
const BASE = 'https://openrouter.ai/api/v1';
const getKey = () => process.env.OPENROUTER_API_KEY;

const MODEL_PRESETS = {
  coding: {
    'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
    'claude-3-opus': 'anthropic/claude-3-opus',
    'deepseek-coder-v2': 'deepseek/deepseek-coder-v2',
    'qwen-2.5-coder-32b': 'qwen/qwen-2.5-coder-32b-instruct',
    'codestral': 'mistralai/codestral-latest',
    'gpt-4o': 'openai/gpt-4o',
    'gemini-2.0-flash': 'google/gemini-2.0-flash-exp'
  },
  reasoning: {
    'claude-3-opus': 'anthropic/claude-3-opus',
    'o1-mini': 'openai/o1-mini',
    'deepseek-r1': 'deepseek/deepseek-r1',
    'gemini-pro-1.5': 'google/gemini-pro-1.5'
  },
  fast: {
    'claude-3-haiku': 'anthropic/claude-3-haiku',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gemini-flash': 'google/gemini-flash-1.5'
  },
  free: {
    'llama-3.1-8b': 'meta-llama/llama-3.1-8b-instruct:free',
    'phi-3-mini': 'microsoft/phi-3-mini-128k-instruct:free'
  }
};

async function getModels() {
  try {
    const r = await axios.get(`${BASE}/models`, { headers: { Authorization: `Bearer ${getKey()}` }, timeout: 10000 });
    return r.data.data.sort((a, b) => a.id > b.id ? 1 : -1);
  } catch { return []; }
}

async function chat(messages, model, tools, systemPrompt, options = {}) {
  model = model || 'anthropic/claude-3.5-sonnet';
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const body = { model, messages: msgs, max_tokens: options.max_tokens || 16000, temperature: options.temperature ?? 0.1 };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
  const r = await axios.post(`${BASE}/chat/completions`, body, {
    headers: { Authorization: `Bearer ${getKey()}`, 'HTTP-Referer': 'https://github.com/yuvrajlaptop2008-byte/ai-dev-agent', 'X-Title': 'AI Dev Agent' },
    timeout: 120000
  });
  return r.data;
}

async function streamChat(data, onChunk, onDone, onError) {
  const { messages, model, systemPrompt, tools } = data;
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const body = { model: model || 'anthropic/claude-3.5-sonnet', messages: msgs, stream: true, max_tokens: 16000, temperature: 0.1 };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
  try {
    const response = await axios.post(`${BASE}/chat/completions`, body, {
      headers: { Authorization: `Bearer ${getKey()}`, 'HTTP-Referer': 'https://github.com/yuvrajlaptop2008-byte/ai-dev-agent', 'X-Title': 'AI Dev Agent' },
      responseType: 'stream', timeout: 120000
    });
    let buffer = '', toolCalls = [];
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) onChunk({ type: 'text', content: delta.content });
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {}
      }
    });
    response.data.on('end', () => onDone({ toolCalls: toolCalls.length ? toolCalls : null }));
    response.data.on('error', onError || console.error);
  } catch (e) { if (onError) onError(e); else throw e; }
}

module.exports = { chat, streamChat, getModels, MODEL_PRESETS };
