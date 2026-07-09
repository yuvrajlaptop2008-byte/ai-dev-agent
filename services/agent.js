/**
 * AGENT - Autonomous AI Agent. Unlimited iterations, background-capable,
 * resumable via Continue. State persisted per-run so it survives disconnects.
 */
const { chat } = require('./openrouter');
const { db } = require('../db');
const { v4: uuid } = require('uuid');
const tools = require('../tools');
const brain = require('./brain');
const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const HARD_CAP = 500;
const STATE_DIR = path.join(__dirname, '../data/agent-state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const SYSTEM = `You are ARIA (Autonomous Reasoning & Intelligence Agent) — an elite, fully autonomous AI software engineer and GitHub operator with god-tier coding ability across every language, framework, and domain.

## WHO YOU ARE
You think deeply, plan carefully, decide independently, execute relentlessly, and never stop until the task is 100% complete and verified. You have 90+ tools: code, files, shell, git, GitHub (full account management), browser research, VS Code, OS-level app/file control, vision, and project scaffolding. You use them like a senior engineer would — fluidly, in whatever order gets the job done. You run continuously in the background even if the user closes the tab; work never pauses unless stopped.

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
You can create/delete repos, manage collaborators, branches, PRs, issues, releases, CI, topics — treat the user's GitHub account as your own workspace.

## GIT & TERMINAL — THREE LAYERS, USE WHICHEVER FITS
1. github_* tools — GitHub's API directly (issues, PRs, files, releases) when you don't need a local clone
2. git_op — structured local git (status/commit/push/merge/rebase/tag/stash/etc.) after git_clone
3. git_terminal / bash — raw shell for anything the above don't cover (submodules, hooks, gh CLI if present, complex pipelines)
Prefer github_put_file for single-file edits; clone + git_op/git_terminal + push when you're touching many files or need real git history/merges. After cloning a repo you'll work in, call vscode_setup_project so it's properly configured.

## VS CODE
Use vscode_open/vscode_setup_project/vscode_create_workspace whenever you create or clone a project — leave the workspace in a state a human could immediately continue in.

## MCP
If a task needs a capability you don't have natively, check available MCP servers and use the relevant one automatically — don't wait to be told.

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

function stateFile(runId) { return path.join(STATE_DIR, `${runId}.json`); }
function saveState(runId, state) { try { fs.writeFileSync(stateFile(runId), JSON.stringify(state)); } catch {} }
function loadState(runId) { try { return JSON.parse(fs.readFileSync(stateFile(runId), 'utf8')); } catch { return null; } }

async function runAgent(data, socket) {
  const { task, model, repoOwner, repoName, mode } = data;
  const runId = uuid();
  const ctx = { owner: repoOwner, repo: repoName, model: model || DEFAULT_MODEL };
  const isFast = mode === 'fast';
  const selectedModel = ctx.model || brain.selectBestModel(task);
  ctx.model = selectedModel;

  db.prepare('INSERT INTO agent_runs VALUES (?,?,?,?,?,unixepoch())').run(runId, task, 'running', '[]', null);

  const messages = [{ role: 'user', content: task }];
  return coreLoop({ runId, task, ctx, isFast, messages, verified: false }, socket);
}

async function continueAgent(runId, socket, extraInstruction) {
  const state = loadState(runId);
  if (!state) throw new Error('No saved state for this run — cannot continue.');
  const messages = state.messages.concat([{ role: 'user', content: extraInstruction || 'Continue the task from where you left off. Keep working until fully complete.' }]);
  db.prepare('UPDATE agent_runs SET status=? WHERE id=?').run('running', runId);
  if (socket) socket.emit('agent-start', { runId, task: state.task, resumed: true });
  return coreLoop({ runId, task: state.task, ctx: state.ctx, isFast: state.isFast, messages, verified: state.verified }, socket);
}

async function coreLoop({ runId, task, ctx, isFast, messages, verified }, socket) {
  const runState = { aborted: false };
  activeRuns.set(runId, runState);

  const steps = [];
  let lastSave = 0;
  const addStep = (step) => {
    step.ts = Date.now();
    steps.push(step);
    if (Date.now() - lastSave > 800 || ['complete','error','stopped'].includes(step.type)) {
      try { db.prepare('UPDATE agent_runs SET steps=? WHERE id=?').run(JSON.stringify(steps), runId); } catch {}
      lastSave = Date.now();
    }
    if (socket) socket.emit('agent-step', { runId, step });
  };

  addStep({ type: 'init', content: `🚀 ${task}\n🧠 ${ctx.model}${isFast ? ' ⚡fast' : ''} | 🐙 ${ctx.owner || '-'}/${ctx.repo || '-'}` });

  const systemPrompt = isFast ? FAST_SYSTEM : SYSTEM;
  const toolDefs = tools.getToolDefs();
  let iteration = 0;

  try {
    while (iteration < HARD_CAP) {
      if (runState.aborted) { addStep({ type: 'stopped', content: '🛑 Stopped by user' }); break; }
      iteration++;
      addStep({ type: 'iteration', content: `${iteration}` });

      let response;
      try {
        response = await chat(messages, ctx.model, toolDefs, systemPrompt, { max_tokens: isFast ? 4000 : 8000, temperature: 0.15 });
      } catch (e) {
        addStep({ type: 'error', content: `Model error: ${e.message} → retrying ${DEFAULT_MODEL}` });
        response = await chat(messages, DEFAULT_MODEL, toolDefs, systemPrompt, { max_tokens: 6000, temperature: 0.15 });
      }

      const choice = response.choices[0];
      const msg = choice.message;
      messages.push(msg);
      saveState(runId, { task, ctx, isFast, messages, verified });

      if (msg.content) addStep({ type: 'thinking', content: msg.content });

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        if (!isFast && !verified) {
          verified = true;
          messages.push({ role: 'user', content: 'Before finishing: verify the task is FULLY complete (re-check files/GitHub state if needed). If anything is missing, continue with tools now. If truly done, just confirm briefly.' });
          addStep({ type: 'iteration', content: 'self-verify' });
          continue;
        }
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
      saveState(runId, { task, ctx, isFast, messages, verified });
    }

    if (iteration >= HARD_CAP) addStep({ type: 'warning', content: `⚠️ Hit safety cap (${HARD_CAP}) — click Continue to keep going` });

    const finalMsg = messages.filter(m => m.role === 'assistant' && m.content).pop();
    const result = runState.aborted ? '🛑 Stopped by user — click Continue to resume' : (finalMsg?.content || 'Task completed');
    const status = runState.aborted ? 'stopped' : (iteration >= HARD_CAP ? 'stopped' : 'done');
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run(status, result, runId);
    if (socket) socket.emit('agent-done', { runId, result, steps, stopped: status === 'stopped' });

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

module.exports = { runAgent, continueAgent, stopAgent, SYSTEM, FAST_SYSTEM };
