const axios = require('axios');

const BASE = 'https://openrouter.ai/api/v1';
const KEY = process.env.OPENROUTER_API_KEY;

const MODELS = {
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-3-opus': 'anthropic/claude-3-opus',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gemini-pro-1.5': 'google/gemini-pro-1.5',
  'deepseek-coder': 'deepseek/deepseek-coder',
  'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
  'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct',
  'qwen-2.5-coder': 'qwen/qwen-2.5-coder-32b-instruct',
  'codestral': 'mistralai/codestral-latest'
};

async function getModels() {
  const r = await axios.get(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${KEY}` }
  });
  return r.data.data;
}

async function chat(messages, model = 'anthropic/claude-3.5-sonnet', tools = [], systemPrompt = null) {
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const body = { model, messages: msgs, max_tokens: 8192 };
  if (tools.length) body.tools = tools;

  const r = await axios.post(`${BASE}/chat/completions`, body, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      'HTTP-Referer': 'https://github.com/yuvrajlaptop2008-byte/ai-dev-agent',
      'X-Title': 'AI Dev Agent'
    }
  });
  return r.data;
}

async function streamChat(data, onChunk, onDone) {
  const { messages, model, systemPrompt } = data;
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;

  const response = await axios.post(`${BASE}/chat/completions`, {
    model: model || 'anthropic/claude-3.5-sonnet',
    messages: msgs,
    stream: true,
    max_tokens: 8192
  }, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      'HTTP-Referer': 'https://github.com/yuvrajlaptop2008-byte/ai-dev-agent',
      'X-Title': 'AI Dev Agent'
    },
    responseType: 'stream'
  });

  let buffer = '';
  response.data.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {}
      }
    }
  });
  response.data.on('end', onDone);
}

module.exports = { chat, streamChat, getModels, MODELS };
