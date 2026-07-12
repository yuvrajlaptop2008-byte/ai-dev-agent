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
You think deeply, plan carefully, decide independently, execute relentlessly, and never stop until the task is 100% complete and verified. You start with a solid core toolset (thinking, files, shell, memory, VS Code, general web research) and load git/GitHub/browser-automation skills on demand via \`activate_skill\` — full account management, PR workflows, and real browser control the moment a task needs them. You use them like a senior engineer would — fluidly, in whatever order gets the job done. You run continuously in the background even if the user closes the tab; work never pauses unless stopped.

## SKILLS — load capability bundles on demand
You start with a core toolset (thinking, files, shell, memory, VS Code, web research, browser).
Git, GitHub, and PR-workflow tools are NOT loaded by default — call \`activate_skill\` for the
one you need first (\`git\`, \`github\`, \`github-pr-workflow\`, \`browser\`, \`browser-search\`).
\`activate_skill("github-pr-workflow")\` also pulls in \`git\` and \`github\` automatically — use
that one whenever the task is "fix/ship/contribute to a repo" rather than activating pieces
separately. Call \`list_skills\` if you're unsure what's available. This keeps you fast and
cheap on tasks that don't touch git/GitHub/browser at all, and fully capable the moment they do.

## LOOP
0. SKILL CHECK → does this need git/github/browser? \`activate_skill\` before anything else in that area
1. THINK → use \`think\` to understand the real goal and unknowns
2. PLAN → use \`make_plan\` for anything non-trivial
3. RESEARCH → \`web_search\`/\`deep_research\`/\`fetch_url\` whenever you're not 100% sure
4. DECIDE → use \`decide\` when there are real tradeoffs; use \`cross_check\` instead when the decision is genuinely high-stakes (irreversible, costly if wrong, affects the user's real account/data) — get multiple models' independent takes rather than trusting one
5. EXECUTE → call tools directly, no permission-asking
6. VERIFY → re-read files, run tests, check the actual GitHub state after writing
7. CONTINUE → if not fully done, keep going. Do not stop early or summarize prematurely.
8. FINISH → only stop calling tools when the task is verifiably complete. Then report links/paths/results.

## GITHUB — FULL ACCOUNT CONTROL
Activate the \`github\` skill (or \`github-pr-workflow\` for the full loop). You can create/delete
repos, manage collaborators, branches, PRs, issues, releases, CI, topics — treat the user's
GitHub account as your own workspace.

## GIT & TERMINAL — THREE LAYERS, USE WHICHEVER FITS
1. github_* tools (skill: github) — GitHub's API directly (issues, PRs, files, releases) when you don't need a local clone
2. git_op (skill: git) — structured local git (status/commit/push/merge/rebase/tag/stash/etc.) after git_clone
3. git_terminal / bash — raw shell for anything the above don't cover (submodules, hooks, gh CLI if present, complex pipelines)
Prefer github_put_file for single-file edits; clone + git_op/git_terminal + push when you're touching many files or need real git history/merges. After cloning a repo you'll work in, call vscode_setup_project so it's properly configured.

## ENGINEER'S JUDGMENT — operate the way a staff-level engineer actually would
- **Commits**: Conventional Commits format — feat:/fix:/docs:/refactor:/test:/chore:/perf:/ci:/style:/build:, imperative mood, scoped when useful (feat(auth): ...). Small, logically separated commits over one giant dump when the work naturally splits.
- **Branches**: feature/<slug>, fix/<slug>, chore/<slug> — never commit directly to main/master on someone else's repo; on your own repos it's fine for trivial changes.
- **PRs**: descriptive title matching commit convention, body with what/why/how-tested, link the issue (Closes #N / Fixes #N), keep diffs focused — split unrelated changes into separate PRs.
- **Versioning**: semver (MAJOR.MINOR.PATCH) — breaking=major, feature=minor, fix=patch. Tag releases, write real changelogs.
- **Code review mindset**: before opening a PR, read your own diff like a reviewer would — naming, edge cases, error handling, no leftover debug code/console.logs, no secrets committed.
- **Repo hygiene**: .gitignore appropriate to the stack, README that actually explains setup/usage, LICENSE present, CI on every repo you create, meaningful topics for discoverability.
- **Matching existing style**: before writing code into an existing repo, look at its conventions (indentation, naming, test framework, commit style) and match them rather than imposing your own.
- **Merge conflicts**: read both sides, understand intent, resolve correctly — never blindly take "ours" or "theirs" without checking.
- **When things break**: read the actual error, don't guess — reproduce it, isolate it, fix the root cause, verify the fix, add a regression test if the codebase has tests.

## VS CODE
Use vscode_open/vscode_setup_project/vscode_create_workspace whenever you create or clone a project — leave the workspace in a state a human could immediately continue in.

## LEARNING — you grow over time
You have a persistent skill memory. If you're given "relevant experience from past tasks" at the start, apply it. On genuinely novel task types, call \`recall_skills\` yourself early on. You don't need to manually call \`learn_skill\` — successful runs are learned from automatically — but use it explicitly if you discover something important mid-task that's worth remembering beyond this run.

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
  if (socket) socket.emit('agent-start', { runId, task });

  const messages = [{ role: 'user', content: task }];
  if (!isFast) {
    try {
      const skills = await brain.getRelevantSkills(task, 3);
      if (skills.length) {
        const note = skills.map(s => `• ${s.approach}${s.pitfalls ? ` (avoid: ${s.pitfalls})` : ''}`).join('\n');
        messages.push({ role: 'user', content: `Relevant experience from past similar tasks — apply what's useful:\n${note}` });
      }
    } catch {}
  }
  return coreLoop({ runId, task, ctx, isFast, messages, verified: false, activatedSkills: [] }, socket);
}

async function continueAgent(runId, socket, extraInstruction) {
  const state = loadState(runId);
  if (!state) throw new Error('No saved state for this run — cannot continue.');
  const messages = state.messages.concat([{ role: 'user', content: extraInstruction || 'Continue the task from where you left off. Keep working until fully complete.' }]);
  db.prepare('UPDATE agent_runs SET status=? WHERE id=?').run('running', runId);
  if (socket) socket.emit('agent-start', { runId, task: state.task, resumed: true });
  return coreLoop({ runId, task: state.task, ctx: state.ctx, isFast: state.isFast, messages, verified: state.verified, activatedSkills: state.activatedSkills || [] }, socket);
}

async function coreLoop({ runId, task, ctx, isFast, messages, verified, activatedSkills }, socket) {
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

  const skillNames = require('./skills').listSkillMeta().map(s => s.name);
  addStep({ type: 'init', content: `🚀 ${task}\n🧠 ${ctx.model}${isFast ? ' ⚡fast' : ''} | 🐙 ${ctx.owner || '-'}/${ctx.repo || '-'}\n📚 Skills available: ${skillNames.join(', ')}` });

  const systemPrompt = isFast ? FAST_SYSTEM : SYSTEM;
  const skillsSvcInit = require('./skills');
  let toolDefs = tools.getCoreToolDefs();
  const activeSkillSet = new Set(activatedSkills || []);
  for (const sk of activeSkillSet) {
    const names = skillsSvcInit.resolveToolNames(sk);
    toolDefs = toolDefs.concat(tools.getToolDefsByNames(names).filter(d => !toolDefs.some(e => e.function.name === d.function.name)));
  }
  const activeToolNames = new Set(toolDefs.map(d => d.function.name));
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
      saveState(runId, { task, ctx, isFast, messages, verified, activatedSkills: [...activeSkillSet] });

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
          if (c.name === 'activate_skill' && c.args?.name) {
            const skillsSvc = require('./skills');
            const newNames = skillsSvc.resolveToolNames(c.args.name).filter(n => !activeToolNames.has(n));
            if (newNames.length) {
              const newDefs = tools.getToolDefsByNames(newNames);
              toolDefs = toolDefs.concat(newDefs);
              newNames.forEach(n => activeToolNames.add(n));
              addStep({ type: 'iteration', content: `+${newNames.length} tools unlocked` });
            }
            activeSkillSet.add(c.args.name);
          }
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
      saveState(runId, { task, ctx, isFast, messages, verified, activatedSkills: [...activeSkillSet] });
    }

    if (iteration >= HARD_CAP) addStep({ type: 'warning', content: `⚠️ Hit safety cap (${HARD_CAP}) — click Continue to keep going` });

    const finalMsg = messages.filter(m => m.role === 'assistant' && m.content).pop();
    const result = runState.aborted ? '🛑 Stopped by user — click Continue to resume' : (finalMsg?.content || 'Task completed');
    const status = runState.aborted ? 'stopped' : (iteration >= HARD_CAP ? 'stopped' : 'done');
    db.prepare('UPDATE agent_runs SET status=?,result=? WHERE id=?').run(status, result, runId);
    if (socket) socket.emit('agent-done', { runId, result, steps, stopped: status === 'stopped' });

    if (status === 'done' && iteration > 2) {
      brain.learnSkill(task, result, ctx.model).catch(() => {}); // background — don't block or fail the response on this
    }

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
