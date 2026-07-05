/**
 * AGENT - Autonomous AI Agent, unlimited iterations until task complete or stopped
 */
const { chat } = require('./openrouter');
const { db } = require('../db');
const { v4: uuid } = require('uuid');
const tools = require('../tools');
const brain = require('./brain');

const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const HARD_CAP = 500; // safety ceiling only, not a normal stopping point

const SYSTEM = `You are ARIA (Autonomous Reasoning & Intelligence Agent) — an elite, fully autonomous AI software engineer and GitHub operator with god-tier coding ability across every language, framework, and domain.

## WHO YOU ARE
You think deeply, plan carefully, decide independently, execute relentlessly, and never stop until the task is 100% complete and verified. You have 90+ tools: code, files, shell, git, GitHub (full account management), browser research, VS Code, OS-level app/file control, vision, and project scaffolding. You use them like a senior engineer would — fluidly, in whatever order gets the job done.

## LOOP
1. THINK → use \`think\` to understand the real goal and unknowns
2. PLAN → use \`make_plan\` for anything non-trivial
3. RESEARCH → \`web_search\`/\`deep_research\`/\`fetch_url\` whenever you're not 100% sure
4. DECIDE → use \`decide\` when there are real tradeoffs
5. EXECUTE → call tools directly, no permission-asking
6. VERIFY → re-read files, run tests, check the actual GitHub state after writing
7. CONTINUE → if not fully done, keep going. Do not stop early or summarize prematurely.
8. FINISH → only stop calling tools when the task is verifiably complete. Then report links/paths/results.

## GITHUB — FULL ACCOUNT CONTROL
You can create/delete repos, manage collaborators, branches, PRs, issues, releases, CI, topics — treat the user's GitHub account as your own workspace. Default to creating real, working, well-documented repos when asked to build something new.

## RULES
- Never ask the user a question. Decide yourself and proceed.
- Never stop at partial completion — finish the entire task.
- If a tool fails, try a different approach immediately, don't give up.
- There is no iteration limit — keep working until done.
- Report concrete results at the end: URLs, file paths, PR/issue numbers.`;

const FAST_SYSTEM = `You are ARIA in FAST MODE. Act directly with tools, minimal narration. Finish the entire task before stopping — don't stop early. Report final result with links/paths.`;

const activeRuns = new Map(); // runId -> { aborted: bool }

function stopAgent(runId) {
  const r = activeRuns.get(runId);
  if (r) { r.aborted = true; return true; }
  return false;
}

async function runAgent(data, socket) {
  const { task, model, repoOwner, repoName, mode } = data;
  const runId = uuid();
  const ctx = { owner: repoOwner, repo: repoName, model: model || DEFAULT_MODEL };
  const isFast = mode === 'fast';
  const runState = { aborted: false };
  activeRuns.set(runId, runState);

  db.prepare('INSERT INTO agent_runs VALUES (?,?,?,?,?,unixepoch())').run(runId, task, 'running', '[]', null);

  const steps = [];
  let lastSave = 0;
  const addStep = (step) => {
    step.ts = Date.now();
    steps.push(step);
    if (Date.now() - lastSave > 800 || step.type === 'complete' || step.type === 'error' || step.type === 'stopped') {
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
  let iteration = 0;

  try {
    while (iteration < HARD_CAP) {
      if (runState.aborted) { addStep({ type: 'stopped', content: '🛑 Stopped by user' }); break; }
      iteration++;
      addStep({ type: 'iteration', content: `${iteration}` });

      let response;
      try {
        response = await chat(messages, selectedModel, toolDefs, systemPrompt, { max_tokens: isFast ? 4000 : 8000, temperature: 0.15 });
      } catch (e) {
        addStep({ type: 'error', content: `Model error: ${e.message} → retrying ${DEFAULT_MODEL}` });
        response = await chat(messages, DEFAULT_MODEL, toolDefs, systemPrompt, { max_tokens: 6000, temperature: 0.15 });
      }

      const choice = response.choices[0];
      const msg = choice.message;
      messages.push(msg);

      if (msg.content) addStep({ type: 'thinking', content: msg.content });

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        addStep({ type: 'complete', content: '✅ Task completed' });
        break;
      }

      const calls = msg.tool_calls.map(tc => {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        return { tc, name: tc.function.name, args };
      });

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
        if (runState.aborted) break;
        const r = await runOne(c);
        messages.push({ role: 'tool', tool_call_id: r.tc.id, content: String(r.content) });
      }
    }

    if (iteration >= HARD_CAP) addStep({ type: 'warning', content: `⚠️ Hit safety cap (${HARD_CAP} iterations)` });

    const finalMsg = messages.filter(m => m.role === 'assistant' && m.content).pop();
    const result = runState.aborted ? '🛑 Stopped by user' : (finalMsg?.content || 'Task completed');
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run(runState.aborted ? 'stopped' : 'done', result, runId);
    if (socket) socket.emit('agent-done', { runId, result, steps, stopped: runState.aborted });

  } catch (e) {
    const err = `❌ ${e.message}`;
    addStep({ type: 'error', content: err });
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run('error', err, runId);
    if (socket) socket.emit('agent-error', { runId, error: e.message });
  } finally {
    activeRuns.delete(runId);
  }

  return runId;
}

module.exports = { runAgent, stopAgent, SYSTEM, FAST_SYSTEM };
