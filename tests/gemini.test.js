const { test } = require('node:test');
const assert = require('node:assert');
const gemini = require('../services/gemini');

test('isGeminiModel distinguishes native gemini- from OpenRouter google/gemini-', () => {
  assert.strictEqual(gemini.isGeminiModel('gemini-3.5-flash'), true);
  assert.strictEqual(gemini.isGeminiModel('google/gemini-2.0-flash-exp:free'), false);
  assert.strictEqual(gemini.isGeminiModel('meta-llama/llama-3.3-70b-instruct:free'), false);
  assert.strictEqual(gemini.isGeminiModel(undefined), false);
});

test('toGeminiContents translates a multi-turn tool-calling history correctly', () => {
  const messages = [
    { role: 'system', content: 'ignored, handled separately via systemInstruction' },
    { role: 'user', content: 'what is 2+2 using the calculator tool' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', function: { name: 'calculator', arguments: '{"a":2,"b":2}' } }] },
    { role: 'tool', tool_call_id: 'call_1', content: '4' },
    { role: 'user', content: 'thanks, now what is that times 10' },
  ];
  const contents = gemini.toGeminiContents(messages);

  assert.strictEqual(contents.length, 4, 'system message should be dropped, 4 remain');
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[1].role, 'model');
  assert.deepStrictEqual(contents[1].parts[0].functionCall, { name: 'calculator', args: { a: 2, b: 2 } });
  assert.strictEqual(contents[2].role, 'user');
  assert.strictEqual(contents[2].parts[0].functionResponse.name, 'calculator', 'tool_call_id should resolve back to the function name');
  assert.strictEqual(contents[2].parts[0].functionResponse.response.result, '4');
  assert.strictEqual(contents[3].parts[0].text, 'thanks, now what is that times 10');
});

test('toGeminiTools maps our OpenAI-format tool defs to functionDeclarations', () => {
  const ourTools = [{ type: 'function', function: { name: 'calculator', description: 'adds two numbers', parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } } }];
  const geminiTools = gemini.toGeminiTools(ourTools);
  assert.strictEqual(geminiTools[0].functionDeclarations[0].name, 'calculator');
  assert.strictEqual(geminiTools[0].functionDeclarations[0].parametersJsonSchema, ourTools[0].function.parameters);
});

test('toGeminiTools returns undefined for no tools (matches openrouter.js behavior)', () => {
  assert.strictEqual(gemini.toGeminiTools([]), undefined);
  assert.strictEqual(gemini.toGeminiTools(undefined), undefined);
});

test('toUnifiedResponse maps a tool-call response into our internal OpenAI-shape', () => {
  const resp = gemini.toUnifiedResponse({ text: null, functionCalls: [{ name: 'calculator', args: { a: 8, b: 32 } }] });
  const msg = resp.choices[0].message;
  assert.strictEqual(msg.tool_calls.length, 1);
  assert.strictEqual(msg.tool_calls[0].function.name, 'calculator');
  assert.deepStrictEqual(JSON.parse(msg.tool_calls[0].function.arguments), { a: 8, b: 32 });
  assert.strictEqual(resp.choices[0].finish_reason, 'tool_calls');
});

test('toUnifiedResponse maps a plain-text response correctly', () => {
  const resp = gemini.toUnifiedResponse({ text: 'The answer is 40.', functionCalls: [] });
  assert.strictEqual(resp.choices[0].message.content, 'The answer is 40.');
  assert.strictEqual(resp.choices[0].message.tool_calls, undefined);
  assert.strictEqual(resp.choices[0].finish_reason, 'stop');
});
