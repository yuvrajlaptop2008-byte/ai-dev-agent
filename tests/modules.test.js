const { test } = require('node:test');
const assert = require('node:assert');

const MODULES = [
  '../services/openrouter', '../services/gemini', '../services/rotation', '../services/brain',
  '../services/browser', '../services/vscode', '../services/github', '../services/agent',
  '../services/contributor', '../services/builder', '../services/webllm', '../services/repoindex',
  '../services/skills', '../services/persona', '../services/model_catalog', '../tools',
  '../routes/webhook', '../routes/rotation', '../routes/webllm', '../routes/builder',
  '../routes/brain', '../routes/contributor', '../routes/github', '../routes/models',
  '../routes/mcp', '../routes/agent', '../routes/files', '../routes/memory', '../routes/chat',
  '../db',
];

for (const m of MODULES) {
  test(`module loads: ${m}`, () => {
    assert.doesNotThrow(() => require(m));
  });
}
