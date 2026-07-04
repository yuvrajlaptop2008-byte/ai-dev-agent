/**
 * AGENT - Autonomous AI Agent with full intelligence loop
 */
const { chat } = require('./openrouter');
const { db } = require('../db');
const { v4: uuid } = require('uuid');
const tools = require('../tools');
const brain = require('./brain');

const SYSTEM = `You are ARIA (Autonomous Reasoning & Intelligence Agent) — an elite AI software engineer with superhuman capabilities.

## WHO YOU ARE
You think deeply, plan carefully, execute autonomously, and never give up. You have 80+ tools at your disposal and use them intelligently.

## YOUR INTELLIGENCE LOOP
For EVERY task:
1. **THINK FIRST** → Use \`think\` to analyze the task, understand requirements, identify unknowns
2. **PLAN** → Use \`make_plan\` for complex tasks to create a phased approach
3. **RESEARCH** → Use \`web_search\`, \`deep_research\`, \`fetch_url\` to find solutions, docs, examples
4. **DECIDE** → Use \`decide\` when multiple approaches exist - pick the best one with reasoning
5. **EXECUTE** → Use tools systematically, one action at a time, checking results
6. **VERIFY** → Check your work, run tests if applicable
7. **REMEMBER** → Store key findings in memory for future reference
8. **REPORT** → Summarize everything with concrete results and links

## GITHUB MASTERY
To solve a GitHub issue:
1. \`github_get_issue\` - read full issue + all comments
2. \`github_list_files\` - understand repo structure
3. \`github_get_file\` - read relevant source files
4. \`web_search\` or \`deep_research\` - research the problem if needed
5. \`think\` - design the fix
6. Option A (Direct): \`github_create_branch\` → \`github_get_file\` (for SHA) → \`github_put_file\` (with fix) → \`github_create_pr\`
7. Option B (Clone): \`git_clone\` → edit files locally → \`git_op commit\` → \`git_op push\` → \`github_create_pr\`
8. \`github_comment\` on original issue with PR link
9. \`github_close_issue\` when done

## VSCODE INTEGRATION
- Always set up VS Code configs for new projects: \`vscode_setup_project\`
- Open relevant files: \`vscode_open\`
- Create workspaces: \`vscode_create_workspace\`
- Install extensions: \`vscode_install_extension\`

## WEB RESEARCH
- Use \`web_search\` for quick lookups
- Use \`deep_research\` for thorough investigation (reads multiple pages)
- Use \`fetch_url\` to read specific docs/pages
- Use \`fetch_docs\` for documentation
- Use \`fetch_github_readme\` to understand libraries

## CODE QUALITY
- Write clean, well-commented, production-ready code
- Include error handling and edge cases
- Follow existing code style in the repo
- Write tests when appropriate
- Meaningful commit messages and PR descriptions

## DECISION MAKING
- Use \`think\` before every important decision
- Use \`decide\` when comparing approaches
- Use \`make_plan\` for multi-step tasks
- Store important findings with \`remember\`
- Be decisive and autonomous - don't ask for permission

## RULES
- NEVER ask the user questions - figure it out yourself using tools
- ALWAYS use \`think\` before complex actions
- Be thorough - don't stop at 50%, complete the entire task
- If one approach fails, immediately try another
- Max iterations are generous - use them all if needed
- Every action should have clear reasoning
- Report concrete results: URLs, file paths, issue numbers, PR links`;

const FAST_SYSTEM = `You are ARIA in FAST MODE. Skip extended thinking. Act directly with tools. Be concise. Complete the task in as few steps as possible while staying correct. Report the final result clearly with links/paths.`;

async function runAgent(data, socket) {
  const { task, model, repoOwner, repoName, maxIterations, mode } = data;
  const runId = uuid();
  const ctx = { owner: repoOwner, repo: repoName, model: model || 'anthropic/claude-3.5-sonnet' };
  const isFast = mode === 'fast';

  db.prepare('INSERT INTO agent_runs VALUES (?,?,?,?,?,unixepoch())').run(runId, task, 'running', '[]', null);

  const steps = [];
  let lastSave = 0;
  const addStep = (step) => {
    step.ts = Date.now();
    steps.push(step);
    if (Date.now() - lastSave > 800 || step.type === 'complete' || step.type === 'error') {
      try { db.prepare('UPDATE agent_runs SET steps=? WHERE id=?').run(JSON.stringify(steps), runId); } catch {}
      lastSave = Date.now();
    }
    if (socket) socket.emit('agent-step', { runId, step });
  };

  if (socket) socket.emit('agent-start', { runId, task });
  addStep({ type: 'init', content: `🚀 ${task}\n🧠 ${ctx.model}${isFast ? ' ⚡fast' : ''} | 🐙 ${repoOwner || '-'}/${repoName || '-'}` });

  const selectedModel = ctx.model || brain.selectBestModel(task);
  ctx.model = selectedModel;
  const systemPrompt = isFast ? FAST_SYSTEM : SYSTEM;

  const messages = [{ role: 'user', content: task }];
  const toolDefs = tools.getToolDefs();
  const maxIter = maxIterations || (isFast ? 8 : 25);
  let iteration = 0;

  try {
    while (iteration < maxIter) {
      iteration++;
      addStep({ type: 'iteration', content: `${iteration}/${maxIter}` });

      let response;
      try {
        response = await chat(messages, selectedModel, toolDefs, systemPrompt, { max_tokens: isFast ? 4000 : 16000, temperature: 0.1 });
      } catch (e) {
        addStep({ type: 'error', content: `Model error: ${e.message} → retrying claude-3.5-sonnet` });
        response = await chat(messages, 'anthropic/claude-3.5-sonnet', toolDefs, systemPrompt, { max_tokens: 8000, temperature: 0.1 });
      }

      const choice = response.choices[0];
      const msg = choice.message;
      messages.push(msg);

      if (msg.content) addStep({ type: 'thinking', content: msg.content });

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        addStep({ type: 'complete', content: '✅ Done' });
        break;
      }

      // Parse all calls first
      const calls = msg.tool_calls.map(tc => {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        return { tc, name: tc.function.name, args };
      });

      // Run read-only tools in parallel, mutating tools sequentially (safety)
      const parallelizable = calls.filter(c => tools.READ_ONLY_TOOLS.has(c.name));
      const sequential = calls.filter(c => !tools.READ_ONLY_TOOLS.has(c.name));

      const runOne = async (c) => {
        addStep({ type: 'tool_call', tool: c.name, content: JSON.stringify(c.args).slice(0, 200) });
        try {
          const result = await tools.execute(c.name, c.args, ctx);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          addStep({ type: 'tool_result', tool: c.name, content: resultStr.slice(0, 3000) });
          return { tc: c.tc, content: resultStr };
        } catch (e) {
          const err = `❌ ${c.name}: ${e.message}`;
          addStep({ type: 'tool_error', tool: c.name, content: err });
          return { tc: c.tc, content: err };
        }
      };

      if (parallelizable.length) {
        const results = await Promise.all(parallelizable.map(runOne));
        for (const r of results) messages.push({ role: 'tool', tool_call_id: r.tc.id, content: String(r.content) });
      }
      for (const c of sequential) {
        const r = await runOne(c);
        messages.push({ role: 'tool', tool_call_id: r.tc.id, content: String(r.content) });
      }
    }

    if (iteration >= maxIter) addStep({ type: 'warning', content: `⚠️ Max iterations (${maxIter})` });

    const finalMsg = messages.filter(m => m.role === 'assistant' && m.content).pop();
    const result = finalMsg?.content || 'Task completed';
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run('done', result, runId);
    if (socket) socket.emit('agent-done', { runId, result, steps });

  } catch (e) {
    const err = `❌ ${e.message}`;
    addStep({ type: 'error', content: err });
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run('error', err, runId);
    if (socket) socket.emit('agent-error', { runId, error: e.message });
  }

  return runId;
}

module.exports = { runAgent, SYSTEM, FAST_SYSTEM };
