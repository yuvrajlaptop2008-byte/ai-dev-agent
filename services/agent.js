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

async function runAgent(data, socket) {
  const { task, model, repoOwner, repoName, maxIterations } = data;
  const runId = uuid();
  const ctx = { owner: repoOwner, repo: repoName, model: model || 'anthropic/claude-3.5-sonnet' };

  db.prepare('INSERT INTO agent_runs VALUES (?,?,?,?,?,unixepoch())').run(runId, task, 'running', '[]', null);

  const steps = [];
  const addStep = (step) => {
    step.ts = Date.now();
    steps.push(step);
    try { db.prepare('UPDATE agent_runs SET steps=? WHERE id=?').run(JSON.stringify(steps), runId); } catch {}
    if (socket) socket.emit('agent-step', { runId, step });
  };

  if (socket) socket.emit('agent-start', { runId, task });
  addStep({ type: 'init', content: `🚀 Task: ${task}\n🧠 Model: ${ctx.model}\n🐙 Repo: ${repoOwner || '(none)'}/${repoName || '(none)'}` });

  // Auto-select best model if not specified
  const selectedModel = ctx.model || brain.selectBestModel(task);
  ctx.model = selectedModel;

  const messages = [{ role: 'user', content: task }];
  const toolDefs = tools.getToolDefs();
  const maxIter = maxIterations || 25;
  let iteration = 0;

  try {
    while (iteration < maxIter) {
      iteration++;
      addStep({ type: 'iteration', content: `Iteration ${iteration}/${maxIter}` });

      let response;
      try {
        response = await chat(messages, selectedModel, toolDefs, SYSTEM, { max_tokens: 16000, temperature: 0.1 });
      } catch (e) {
        addStep({ type: 'error', content: `Model error: ${e.message}. Retrying with claude-3.5-sonnet...` });
        response = await chat(messages, 'anthropic/claude-3.5-sonnet', toolDefs, SYSTEM, { max_tokens: 16000, temperature: 0.1 });
      }

      const choice = response.choices[0];
      const msg = choice.message;
      messages.push(msg);

      if (msg.content) {
        addStep({ type: 'thinking', content: msg.content });
      }

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        addStep({ type: 'complete', content: '✅ Agent completed task' });
        break;
      }

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}

        const argPreview = JSON.stringify(args).slice(0, 200);
        addStep({ type: 'tool_call', tool: toolName, content: argPreview });

        let result;
        try {
          result = await tools.execute(toolName, args, ctx);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          addStep({ type: 'tool_result', tool: toolName, content: resultStr.slice(0, 3000) });
          result = resultStr;
        } catch (e) {
          result = `❌ Tool error (${toolName}): ${e.message}`;
          addStep({ type: 'tool_error', tool: toolName, content: result });
        }

        messages.push({ role: 'tool', tool_call_id: tc.id, content: String(result) });
      }
    }

    if (iteration >= maxIter) addStep({ type: 'warning', content: `⚠️ Reached max iterations (${maxIter})` });

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

module.exports = { runAgent, SYSTEM };
