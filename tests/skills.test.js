const { test } = require('node:test');
const assert = require('node:assert');
const tools = require('../tools');
const skills = require('../services/skills');

test('at least 6 skills are defined', () => {
  const meta = skills.listSkillMeta();
  assert.ok(meta.length >= 6, `expected >=6 skills, got ${meta.length}`);
});

test('every skill tool name resolves to a real, executable tool implementation', async () => {
  const missing = [];
  for (const meta of skills.listSkillMeta()) {
    const names = skills.resolveToolNames(meta.name);
    for (const n of names) {
      try {
        await tools.execute(n, {}, {});
      } catch (e) {
        if (e.message.startsWith('Unknown tool')) missing.push(`${meta.name} -> ${n}`);
        // any other error (missing required args, etc.) is fine — it proves the tool exists
      }
    }
  }
  assert.deepStrictEqual(missing, [], `skills reference tools with no implementation: ${missing.join(', ')}`);
});

test('github-pr-workflow cascades to include git + github tools', () => {
  const names = skills.resolveToolNames('github-pr-workflow');
  assert.ok(names.includes('git_op'), 'should include git skill tools');
  assert.ok(names.includes('github_create_pr'), 'should include github skill tools');
});

test('core tool set excludes every skill-owned tool', () => {
  const core = tools.getCoreToolDefs().map(d => d.function.name);
  const coreSet = new Set(core);
  for (const meta of skills.listSkillMeta()) {
    for (const n of skills.resolveToolNames(meta.name)) {
      assert.ok(!coreSet.has(n), `${n} (owned by skill ${meta.name}) should not be in core tools`);
    }
  }
});

test('getToolDefsByNames returns exactly the requested tools, no more no less', () => {
  const names = ['git_op', 'github_create_pr'];
  const defs = tools.getToolDefsByNames(names);
  assert.strictEqual(defs.length, 2);
  assert.deepStrictEqual(defs.map(d => d.function.name).sort(), names.sort());
});
