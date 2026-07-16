/**
 * GEMINI — native Google Gemini API via @google/genai (not routed through OpenRouter).
 * Translates our OpenAI-shape {messages, tools} to Gemini's {contents, functionDeclarations}
 * and back, so agent.js's coreLoop works identically regardless of which provider is used.
 */
const { GoogleGenAI } = require('@google/genai');
const rotation = require('./rotation');

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

function isGeminiModel(model) { return /^gemini-/.test(model || ''); }

function getClient() {
  const key = rotation.getGeminiKey();
  return new GoogleGenAI({ apiKey: key });
}

// Our tool defs are already OpenAI-format {type:'function', function:{name, description, parameters}}
// — parameters is standard JSON Schema, which Gemini's parametersJsonSchema accepts directly.
function toGeminiTools(tools) {
  if (!tools?.length) return undefined;
  return [{ functionDeclarations: tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    parametersJsonSchema: t.function.parameters,
  })) }];
}

// Translate our full OpenAI-shape message history (including past assistant tool_calls and
// tool-role results) into Gemini's contents[] — Gemini has no generic "tool" role, it needs
// functionResponse parts keyed by function name, so we track id->name as we walk the history.
function toGeminiContents(messages) {
  const idToName = {};
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] });
    } else if (m.role === 'assistant') {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      if (m.tool_calls) for (const tc of m.tool_calls) {
        idToName[tc.id] = tc.function.name;
        let args = {}; try { args = JSON.parse(tc.function.arguments); } catch {}
        parts.push({ functionCall: { name: tc.function.name, args } });
      }
      if (parts.length) contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      const name = idToName[m.tool_call_id] || 'unknown_function';
      contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: m.content } } }] });
    }
  }
  return contents;
}

function toUnifiedResponse(response) {
  const functionCalls = response.functionCalls || [];
  const tool_calls = functionCalls.length ? functionCalls.map((fc, i) => ({
    id: `gemini_${Date.now()}_${i}`,
    type: 'function',
    function: { name: fc.name, arguments: JSON.stringify(fc.args || {}) },
  })) : undefined;
  return {
    choices: [{
      message: { role: 'assistant', content: response.text || null, tool_calls },
      finish_reason: tool_calls ? 'tool_calls' : 'stop',
    }],
  };
}

async function chat(messages, model, tools, systemPrompt, opts = {}) {
  const ai = getClient();
  const config = {};
  if (systemPrompt) config.systemInstruction = systemPrompt;
  const geminiTools = toGeminiTools(tools);
  if (geminiTools) config.tools = geminiTools;
  try {
    const response = await ai.models.generateContent({
      model: model || DEFAULT_GEMINI_MODEL,
      contents: toGeminiContents(messages),
      config,
    });
    rotation.reportModelResult(model || DEFAULT_GEMINI_MODEL, true);
    return toUnifiedResponse(response);
  } catch (e) {
    rotation.reportModelResult(model || DEFAULT_GEMINI_MODEL, false);
    if (rotation.status().geminiKeys > 1 && !opts._keyRotated) {
      rotation.rotateGemini();
      return chat(messages, model, tools, systemPrompt, { ...opts, _keyRotated: true });
    }
    throw e;
  }
}

async function streamChat(data, onChunk, onDone, onError) {
  const { messages, systemPrompt, tools, model } = data;
  try {
    const ai = getClient();
    const config = {};
    if (systemPrompt) config.systemInstruction = systemPrompt;
    const geminiTools = toGeminiTools(tools);
    if (geminiTools) config.tools = geminiTools;
    const stream = await ai.models.generateContentStream({
      model: model || DEFAULT_GEMINI_MODEL,
      contents: toGeminiContents(messages),
      config,
    });
    let sawToolCall = false;
    for await (const chunk of stream) {
      if (chunk.text) onChunk({ type: 'text', content: chunk.text });
      if (chunk.functionCalls?.length) sawToolCall = true;
    }
    rotation.reportModelResult(model || DEFAULT_GEMINI_MODEL, true);
    onDone({ toolCalls: sawToolCall ? [] : null }); // streaming tool-call assembly not needed for chat UI path
  } catch (e) {
    rotation.reportModelResult(model || DEFAULT_GEMINI_MODEL, false);
    if (onError) onError(e); else throw e;
  }
}

module.exports = { chat, streamChat, isGeminiModel, GEMINI_MODELS, DEFAULT_GEMINI_MODEL, toGeminiContents, toGeminiTools, toUnifiedResponse };
