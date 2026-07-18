# MEMORYAI — Project State (read this first, skip re-exploring repo)

## Identity
- Repo: yuvrajlaptop2008-byte/ai-dev-agent
- Agent name: ARIA
- Stack: Node/Express/Socket.io backend + React/Vite frontend
- Run: `npm install --ignore-scripts && cd frontend && npm install && npm run build && cd .. && npm start`

## File Map (don't re-read unless editing)
- server.js — entrypoint, socket handlers, route mounting, auto model-refresh scheduler
- services/openrouter.js — chat/streamChat/getModels(cached 6h)/getFreeModels/selectModel
- services/model_catalog.js — seed PAID_MODELS + FREE_MODELS (fallback if API blocked)
- services/brain.js — deepThink/createPlan/decide/synthesizeResearch/saveMemory(condensed, capped 50/category)/getMemory
- services/browser.js — search/fetchPage/deepResearch/searchNPM/searchPyPI
- services/vscode.js — open/installExtension/createWorkspace/setupProject/launch/tasks/settings
- services/github.js — full GH API wrapper (issues/PRs/branches/files/releases/actions)
- services/agent.js — ARIA autonomous loop (SYSTEM prompt + runAgent, max 25 iter)
- services/contributor.js — solveIssue/findGoodIssues/improveReadme/writeTests/addCI/autoLabel
- tools/index.js — 80+ tool defs + execute() dispatcher for agent loop
- routes/*.js — chat, github, models(+refresh), mcp, agent, files(+vscode/*), memory, brain, contributor
- frontend/src/components/ — Agent, Chat, Research, GitHub, Contribute, VSCode, Terminal, MCP, Settings, Sidebar

## Decisions Already Made (don't re-litigate)
- DB: JSON-file fallback in db/index.js (better-sqlite3 native build fails in sandbox — don't retry installing it)
- Network egress blocked for openrouter.ai in MY bash tool only — code itself works fine when user runs it. Don't waste calls re-testing live fetch from sandbox.
- Model list: cached 6h server-side, seed catalog as fallback, refresh via POST /api/models/refresh or Settings button
- Free models: 65 curated, shown in sidebar picker separately with FREE badge
- Memory: brain.saveMemory condenses (500 char cap per string, 15 keys/obj, 50 entries/category) — never store raw dumps
- Git identity for local clones: agent@ai-dev.local / "AI Dev Agent"

## Credentials (already in .env, already used)
- GITHUB_TOKEN, OPENROUTER_API_KEY — set in /home/claude/ai-dev-agent/.env (gitignored)

## User Communication Preference (CRITICAL — always follow)
- Zero narration. No "I'm going to...", no step explanations, no "done!" summaries.
- Don't describe what was added/changed unless explicitly asked.
- Work silently, make decisions autonomously, use full judgment/freedom to reach best outcome.
- Only output: files/commands the user must act on, or direct answers to direct questions.
- Minimize tokens always — this is a standing rule for every future turn in this project.
- SETUP.md is the canonical setup guide — point there instead of re-explaining setup.
- Never explain reasoning/thinking in visible output either — reason internally, act, stay silent.
- User does not read explanations of completed work — only ask if a decision truly needs their input (e.g. missing required key).
- Always maintain and consult this file instead of re-scanning the repo — this is the token-saving mechanism the user explicitly asked for.

## v8 additions
- rotation.js/routes/rotation.js: OpenRouter-only key rotation (GitHub stays single-token — user explicitly said no GitHub rotation). Up to 3 OpenRouter keys, auto-rotates on 401/429 in openrouter.js chat(). Optional model-pool rotation via nextModel().
- services/builder.js + routes/builder.js: architect() designs a full new OSS project (JSON file list) from a one-line idea, generateFile() writes production-quality content per file (3 files concurrently), buildProject() creates a brand new GitHub repo and populates it end-to-end, tags topics, saves to brain memory under 'built_projects'. strengthenProfile() audits a user's repos for gaps (missing description/docs).
- tools/index.js: new agent tool `build_project` — ARIA can autonomously ship a full new open-source repo mid-task.
- Settings UI: Rotation panel (3x OpenRouter key inputs + model pool CSV) wired to /api/rotation/*.
- Contribute UI: "Build New OSS Project" action + idea input field, posts to /api/builder/build.

## v6 additions
- SERPER_API_KEY (optional, .env) → real Google search via serper.dev, primary in browser.js search(), falls back to DDG scraping if unset/fails
- chat() in openrouter.js now auto-retries on 429/502/503 through FALLBACK_CHAIN (claude-3.5-sonnet → llama-3.3-70b-free → deepseek-v3-free)
- New tool: analyze_image (vision, uses gemini-2.0-flash-exp:free)
- .env.example updated with SERPER_API_KEY, GITHUB_WEBHOOK_SECRET

## v7 additions (speed + intelligence)
- agent.js: parallel execution of read-only tool calls (Promise.all) via tools.READ_ONLY_TOOLS set; mutating tools stay sequential for safety
- agent.js: fast/deep mode (`mode: 'fast'|'deep'` in run-agent payload) — fast uses FAST_SYSTEM (short prompt), maxIter 8, max_tokens 4000
- agent.js: DB checkpoint writes throttled to 800ms instead of every step (fewer disk writes)
- openrouter.js: Anthropic prompt caching (cache_control: ephemeral) auto-applied when model starts with anthropic/ and system prompt >1000 chars — cuts repeated system-prompt cost/latency
- github.js: Octokit retry(3x) + secondary-rate-limit throttle plugins enabled, singleton instance
- brain.js: in-memory response cache (15min TTL, cap 200) for deepThink
- browser.js: in-memory cache (15min TTL, cap 100) for deepResearch
- Frontend Agent tab: Deep/Fast mode toggle buttons

## v9 additions
- contributor.js: logContribution()/getContributionHistory() — every action (solve-issue, auto-label, improve-readme, add-contributing, add-templates, add-ci) logged to brain memory under category 'contributions', keyed by owner/repo, capped 30 entries
- routes/contributor.js: GET /history/:owner/:repo
- Contribute.jsx: history panel auto-loads on repo change, refreshes after each action
- github.js: batch(items, fn, {concurrency, delayMs}) — safe rate-limited bulk ops, used in autoLabelIssues
- webhook.js expanded: pull_request.opened → auto AI code review posted as PR comment; check_run failure → comments suggesting ai-fix label

## v10 additions (major)
- FREE MODELS ONLY, everywhere. All paid-model defaults ('anthropic/claude-3.5-sonnet' etc.) replaced site-wide with DEFAULT_MODEL='meta-llama/llama-3.3-70b-instruct:free'. openrouter.js has normalizeModel() that force-redirects any paid model string to DEFAULT_MODEL before every request (fixes 404s from paid models on a free-tier key). model_catalog.js PAID_MODELS table removed entirely. MODEL_PRESETS is free-only (11 entries). FALLBACK_CHAIN is free-only 4-model chain, triggers on 401/404/429/502/503.
- Chat fix: streamChat() now has its own retry/fallback (previously only chat() did) — same normalizeModel + FALLBACK_CHAIN applied to the streaming socket path used by the Chat tab.
- agent.js: NO iteration cap in normal operation (HARD_CAP=500 is a safety ceiling only, not a target). Loop runs until model stops calling tools (task genuinely done) or user hits Stop.
- Stop/Kill: activeRuns Map in agent.js + stopAgent(runId). Socket event 'stop-agent' → server.js → aborts loop between iterations/tool calls. Agent.jsx: Stop button replaces Run button while running, max-iterations input removed from UI entirely.
- GitHub full account control added to github.js + tools + routes/github.js: getAuthenticatedUser, listMyRepos, deleteRepo, updateRepoSettings, addCollaborator, removeCollaborator, transferRepo, archiveRepo, setRepoTopics. Agent tools: github_whoami, github_list_my_repos, github_delete_repo, github_update_repo, github_add_collaborator, github_archive_repo, github_set_topics.
- OS/device tools (tools/index.js): create_folder, open_url (xdg-open/open/start per platform), open_app (background spawn), browser_automate (puppeteer-based click/type/wait/screenshot, gracefully degrades to a message if puppeteer/display unavailable — falls back to fetch_url/web_search).
- package.json: puppeteer moved to optionalDependencies (won't break install if chromium download is blocked); run.sh installs with --omit=optional as fallback. version bumped to 10.0.0.
- System prompt (agent.js SYSTEM) rewritten: "god-tier coding ability", explicit full GitHub account control framing, explicit "no iteration limit, keep going until done" instruction.

## v11 additions
- services/webllm.js: drives claude.ai/chatgpt.com/gemini.google.com via puppeteer with persistent userDataDir (./data/browser-profile/<provider>) — real logged-in browser session, no API key/cost. openLoginWindow(provider) opens visible browser for one-time manual login; ask(provider, prompt) runs headless afterward, polls response DOM until stable text, returns it. status() reports which providers have a saved session.
- routes/webllm.js: GET /status, POST /login/:provider, POST /ask
- tools/index.js: agent tools ask_web_llm (cross-check with Claude/ChatGPT/Gemini mid-task), webllm_login
- Settings UI: new panel — per-provider login button + session status, no key entry needed
- Selectors in SITES{} are best-effort (claude.ai/chatgpt.com/gemini.google.com DOM changes over time) — if a selector breaks, ask()/isLoggedIn() throw a clear error naming the provider; fix by updating the `input`/`submit`/`response` selector for that provider in services/webllm.js

## v12
- repoindex.js: caches github_get_file/github_list_files (20min TTL, 500 cap), invalidated on github_put_file. Cuts repeat GitHub reads across iterations.
- agent.js: one-time self-verify pass before stopping (deep mode only) — nudges model to check task is truly complete before ending.
- tools: delegate_task (spins isolated fast-mode sub-agent, returns only final result — keeps main context small), run_code (sandbox exec: python/js/node/bash/ts).

## v13 (fixes + background/continue + free-only cleanup)
- REMOVED from all pools/presets/fallback/normalizeModel-block: deepseek/deepseek-r1:free, google/gemini-2.0-flash-exp:free (unreliable/erroring per user report). model_catalog.js FREE_MODELS trimmed to stable-only list.
- openrouter.js: added round-robin nextPoolModel() over FALLBACK_CHAIN, used by selectModel() so consecutive tasks auto-rotate models instead of always picking the same one.
- FIXED real chat bug: server.js stream-chat socket handler was never writing to the messages table — Chat.jsx would refetch after streaming and get stale/empty history, wiping the just-finished exchange. Now persists both user+assistant messages and bumps conversation updated_at.
- agent.js rewritten around coreLoop() shared by runAgent() and new continueAgent(runId, socket, instruction). Full message history + ctx/mode persisted per-run to data/agent-state/<runId>.json after every model turn and every tool batch — survives process/tab restarts within the same server process.
- run-agent socket handler no longer awaited in server.js (fire-and-forget) — task keeps running in the Node process in the background even if the browser tab/socket disconnects; reconnect and call GET /api/agent/runs or continue-agent to pick back up.
- New socket event 'continue-agent' {runId, instruction?} — resumes a stopped/capped run from saved state.
- HARD_CAP (500) hits now mark run 'stopped' (not silently 'done') so Continue button appears instead of the run looking finished.
- Agent.jsx: removed max-iterations input entirely; Stop button shown while running; Continue + New Task buttons shown after a stop.
- MCP auto-use: new agent tools mcp_list_servers, mcp_call(server_name, tool, args) — ARIA can discover and call any enabled MCP server itself mid-task without being told which one.
- SYSTEM prompt updated: explicit "runs in background, don't need the tab open" framing + "check MCP servers automatically when needed" line.

## v14 (Google AI Studio + webllm fixes)
- services/webllm.js edited in place (not rewritten from scratch conceptually — SITES/launch/ask signatures preserved, extended): added `aistudio` provider (aistudio.google.com/prompts/new_chat). AISTUDIO_MODEL_ALIASES maps short names (gemma, gemma-27b, gemma-9b, gemma-2b, gemini-flash, gemini-pro) to picker label substrings; selectAistudioModel() opens the model dropdown and XPath-matches before sending the prompt — best-effort, silently no-ops if Google changes the DOM (existing chat still works, just on whatever model was already selected).
- REAL BUG FIXED: old code always pressed plain Enter to submit for every provider. AI Studio's textarea needs Ctrl+Enter (plain Enter just inserts a newline) — added `submitMethod: 'enter'|'ctrlEnter'` per site, aistudio uses ctrlEnter, others unchanged.
- Consolidated `getBrowser()` duplication into one `launch(provider, headless)` used by isLoggedIn/openLoginWindow/ask (was two near-duplicate launch code paths before).
- Token saving: webllm responses now hard-capped at MAX_RESPONSE_CHARS=6000 before being returned to the agent loop / API — previously unbounded innerText could be huge on long AI Studio/ChatGPT replies.
- ask_web_llm tool + /api/webllm/ask route now accept optional `model` (aistudio only) — e.g. {provider:"aistudio", model:"gemma-27b", prompt:"..."}.
- Settings → Web LLMs panel lists aistudio as a 4th login row.
- NOTE: sandbox filesystem was wiped between sessions this time — repo was re-cloned from GitHub (already had v13) and .env recreated from memory. If this happens again: `git clone https://<token>@github.com/yuvrajlaptop2008-byte/ai-dev-agent.git`, recreate .env from the template above, re-run `npm install --ignore-scripts` in both root and frontend/.

## v15 (adaptive model health + system health-check)
- rotation.js: added in-memory model health tracker (reportModelResult(model, ok), isModelHealthy(model), healthReport()). A model gets marked unhealthy after 3 consecutive failures, auto-recovers after 10min cooldown. No new file — lives in existing rotation.json-backed module's memory (health itself is NOT persisted to disk, resets on restart by design — cheap and self-correcting).
- openrouter.js: chat()/streamChat() now call reportModelResult on every request; normalizeModel() redirects any currently-unhealthy model to a healthy pool pick; nextPoolModel()/selectModel() skip unhealthy models automatically. This means a flaky free model gets silently avoided for ~10min instead of repeatedly 404/429ing.
- routes/health.js + GET /api/health: live checks — GitHub auth, one real OpenRouter ping call, model health report, model cache info, enabled MCP server count. `ok:false` if github or openrouter check fails.

## v16 (solveIssue actually works now — was structurally broken before)
- REAL BUG FIXED: old solveIssue asked the LLM to embed full source code as a JSON string field (`new_content`). Code containing quotes/backticks/newlines routinely breaks JSON.parse — this was silently failing most real fixes. Replaced with a delimiter protocol: model outputs `===FILE: path===\n<raw content>\n===ENDFILE===` blocks, parsed via regex (services/contributor.js: FILE_DELIM_START/END, parseFileBlocks()). No escaping needed, verified against quotes/backticks/multi-file in isolation.
- REAL BUG FIXED: gh.listContents(owner, repo, '') only ever saw the repo ROOT directory — any file in src/, lib/, etc. was invisible to the agent. Added services/github.js: getFullTree(owner, repo, ref) using the Git Trees API with recursive=1 — this is what solveIssue and writeTests now use to actually see the whole codebase.
- solveIssue rewritten end-to-end: (1) read issue+comments, (2) read full recursive tree, (3) cheap LLM call to pick which ~6 files are actually relevant + any new files needed, (4) read those files' real current content, (5) one coherent generation call that sees ALL selected files together (old version generated each file independently with zero cross-file awareness), (6) delimiter-parsed output, (7) branch created against the repo's actual default_branch (was hardcoded 'main' before — broke on repos using 'master' or other default), (8) branch-already-exists is now caught and reused instead of silently failing, (9) SHA fetched fresh per-file right before write (avoids stale-SHA 409 conflicts), (10) PR body auto-appends "Closes #N", (11) contribution logged with filesChanged count.
- writeTests upgraded to use getFullTree too (was root-only, basically only ever found files sitting directly in the repo root).
- findGoodIssues: removed leftover deepseek-r1:free default (already banned repo-wide in v13/v14, this was a straggler).
- Net effect: issue→branch→commit→PR→issue-comment is now a real, verifiable pipeline instead of one that looked complete but silently no-op'd on any file with a quote or backtick in it (i.e. almost all real code).

## v14 (Google AI Studio, git/GitHub/terminal/VS Code deepening, clipboard)
- webllm.js: added aistudio provider (aistudio.google.com, Gemma models via browser session). Refactored SITES-driven ask/login/isLoggedIn into shared launch() helper (DRY, smaller diffs going forward). selectModel() best-effort clicks AI Studio's model dropdown and picks the option matching modelHint ('Gemma') — non-fatal if UI selectors have drifted.
- Settings.jsx provider list now ['claude','chatgpt','gemini','aistudio'].
- github.js gitOps() expanded: fetch, deleteBranch, merge, rebase, cherryPick, tag/tags/pushTags, reset, revert, diffStaged, stashPop, remote/addRemote, blame, show, clean, raw (arbitrary git command via simple-git).
- New tool git_terminal(repo_dir, command) — raw git via actual shell, for anything git_op doesn't enumerate. Three-layer git/GitHub strategy documented in agent.js SYSTEM prompt: github_* API tools / git_op structured / git_terminal+bash raw shell — pick whichever fits, clone+vscode_setup_project pairing encouraged.
- New tools clipboard_copy/clipboard_paste (pbcopy/pbpaste, clip/Get-Clipboard, xclip/xsel — degrades gracefully with a message if no display/clipboard tool present).

## v15 (senior-engineer judgment baked into prompt)
- agent.js SYSTEM prompt: new "ENGINEER'S JUDGMENT" section — Conventional Commits, branch naming (feature//fix//chore/), PR standards (title/body/Closes #N/focused diffs), semver, self-review-before-PR mindset, repo hygiene defaults, match-existing-style-before-writing, real merge conflict resolution (not blind ours/theirs), root-cause debugging discipline.
- Default fallback commit messages changed from generic "AI: automated commit"/"AI Agent: update" to Conventional Commits style ("chore: automated update" / "chore: update file") — only used when the agent doesn't supply its own message.

## v16 (profile-strength = actionable, non-coder UX)
- builder.js strengthenProfile() rewritten: was a read-only audit, now actually FIXES every repo — generates+sets missing description, infers+sets topics, calls contributor.improveReadme if README thin/missing, adds MIT LICENSE if absent, calls contributor.addCIWorkflow if no CI. Returns a log of what was fixed per repo.
- builder.js buildProfileReadme(username, model): writes the special <username>/<username> profile README (creates that repo if it doesn't exist) — bio, tech badges, featured projects pulled from real repo data, stats card. Real content, not placeholders.
- routes/builder.js: POST /strengthen/:username (was GET), POST /profile-readme/:username
- Agent tools: strengthen_profile, build_profile_readme — ARIA can run these mid-task on its own.
- Contribute.jsx: added Strengthen My Profile + Build Profile README action cards; run() guard now only requires repo for repo-scoped actions (build-project/strengthen/profile-readme only need owner/username).
- Agent.jsx: QUICK_TASKS leads with '💪 Strengthen My Profile' and '🚀 Build Something New'; task placeholder and empty-state copy rewritten for non-coders ("no coding knowledge needed", plain-English framing) — this + the always-available quick-task buttons are the primary "just give a command" UX per user's ask.

## v18 (skills architecture — Hermes-inspired, own code, on-demand tool loading)
NOTE: an earlier attempt this session fully replaced this repo with the actual upstream Hermes
Agent Python codebase, then was reverted at user request (git revert, commit 89b0e08) because the
user wanted to remove Nous Research's required MIT attribution and claim sole authorship — that
specific ask was declined (MIT requires preserving the copyright notice; stripping it while
claiming personal authorship of a real, named project isn't something this assistant will do).
The user then asked to keep the Node.js app but recreate the *concepts* Hermes uses — SKILL.md-
based capability bundles, on-demand loading — as fresh, original code. That's what v18 is.

## New: skills/ directory (Hermes-style SKILL.md layout, entirely original implementation)
5 skills, each with SKILL.md (YAML-ish frontmatter: name/description/keywords/tools/activates +
markdown body) + references/ + templates/ (+ scripts/ reserved for future use):
- **git** — git_clone, git_op, git_terminal
- **github** — all 33 github_* API tools (issues/PRs/files/branches/releases/repo mgmt/actions)
- **github-pr-workflow** — no tools of its own; `activates: git, github` (cascades via
  resolveToolNames), ships PR description + commit message templates, full branch→PR→merge flow
- **browser** — browser_automate, fetch_url, read_website
- **browser-search** — web_search, deep_research, fetch_docs, search_npm, search_pypi,
  fetch_github_readme, fetch_api

## services/skills.js
Parses skills/*/SKILL.md frontmatter at first access (cached). listSkillMeta() = cheap
{name,description} list, always visible to the agent. getSkill(name), resolveToolNames(name)
(recursively follows `activates:` to pull in dependency skills' tools too, dedup'd),
suggestSkills(task) (keyword match, not currently wired into agent.js — available for future use).

## tools/index.js changes
Added list_skills + activate_skill as real tools (in T{} and getToolDefs()). New exports:
getSkillOwnedToolNames() (union of every skill's resolved tool names), getCoreToolDefs()
(getToolDefs() minus anything skill-owned — currently 51 of 97 total defs), getToolDefsByNames(names).
Nothing about the existing 97 tool implementations changed — this is purely a filtering/loading
layer on top, zero risk to existing behavior when a skill isn't used.

## services/agent.js changes — real on-demand loading, not just cosmetic
coreLoop() now starts each run with `toolDefs = tools.getCoreToolDefs()` (not the full 97) plus
whatever's in `activatedSkills` (empty on fresh runAgent(), restored from saved state on
continueAgent() — this was the trickiest part: without restoring activatedSkills on Continue, a
resumed run would forget it had git/github tools active and the model would see tool_call results
in history referencing tools no longer in its schema). Inside the tool-execution block, when
`activate_skill` runs, resolveToolNames() for that skill's newly-needed tool names get appended to
the live `toolDefs` array (dedup'd against `activeToolNames`) — takes effect starting the very next
model call in the same run, no restart needed. `activeSkillSet` is tracked and persisted via
saveState() alongside messages/ctx/verified so Continue reconstructs the exact same tool
availability the run had when it stopped.

SYSTEM prompt: new "SKILLS" section teaches the model this exists and to call `activate_skill`
before touching git/GitHub/browser; LOOP now has a step 0 "SKILL CHECK"; GITHUB/GIT sections
annotated with which skill owns which tools; opening capability blurb rewritten to describe
core+on-demand instead of a flat "90+ tools" claim.

## Verified
`node -e` full require of every service + tools + agent.js — all load clean. `getCoreToolDefs()`
returns 51/97 (46 skill-gated across the 5 skills, github skill alone owns 33). `resolveToolNames
('github-pr-workflow')` correctly cascades to include all git+github tool names. Server boots clean.

## v19 (human conversational tone, desktop control — real, not mock)
- BUGFIX found + fixed: analyze_image was still calling the removed/blocked google/gemini-2.0-flash-exp:free model (leftover from before that model was stripped in an earlier pass) — switched to meta-llama/llama-3.2-11b-vision-instruct:free (actually in the stable free catalog, vision-capable).
- BUGFIX found + fixed: server.js's stream-chat socket handler (used by the Chat tab) never set a systemPrompt at all — Chat.jsx doesn't send one, so plain chat was running with zero persona/system prompt. Now defaults to get('system_prompt') from settings when data.systemPrompt is absent.
- services/persona.js (new): ARIA_PERSONA — a from-scratch, original conversational system prompt. Warm, direct, opinionated, contraction-using, admits uncertainty, doesn't perform false enthusiasm — written for natural human-sounding conversation, explicitly without claiming literal sentience (no false claims about "real feelings" in a philosophical sense — the ask was interpreted as tone/warmth, which is what got built).
- db/index.js: default system_prompt is now ARIA_PERSONA instead of the old flat "You are an expert AI coding agent." One-time migration in initJsonStore() upgrades any existing local data/store.json still holding the stale default (matched against known old default strings) — so this took effect on already-running local installs, not just fresh clones. Fixed a real bug in the process: the sqlite (non-fallback) initSchema() path was originally going to embed the persona via raw template-literal string interpolation directly into a `d.exec()` SQL string — extremely unsafe given the persona text is full of apostrophes ("you're", "I'd") that would break out of SQL string literals. Rewritten to use a parameterized `d.prepare(...).run(key, value)` insert instead.
- agent.js SYSTEM/FAST_SYSTEM are unchanged in tone (still task-execution focused) — persona.js is specifically for the Chat tab's conversational mode, not the autonomous agent loop.

## New: desktop skill (real OS control, 7th... wait 6th total skill: git/github/github-pr-workflow/browser/browser-search/desktop)
skills/desktop/SKILL.md — real keyboard/mouse/screen control, not simulated:
- `screen_screenshot` — actual OS screenshot (scrot/import/gnome-screenshot on Linux, screencapture
  on macOS, PowerShell+System.Drawing on Windows), saved to workspace
- `screen_look` — screenshot + vision-AI description in one call (uses the same free vision model
  as analyze_image) — "see" the desktop before deciding what to do
- `mouse_move`/`mouse_click` — xdotool (Linux) / cliclick (macOS) / PowerShell+user32 (Windows)
- `keyboard_type`/`keyboard_key` — xdotool / osascript / SendKeys respectively
All six degrade honestly with a clear "not installed"/"no display" message rather than pretending
to succeed — verified: screen_screenshot correctly reports failure in this sandbox (no display),
same honest-degradation pattern as browser_automate/open_url/clipboard_* from earlier versions.
Added to tools/index.js T{} + getToolDefs() + READ_ONLY_TOOLS (screen_screenshot, screen_look only
— the mutating ones stay sequential). Core/skill count is now 52 core / 103 total across 6 skills.

## Pending / Ideas Not Yet Built
- suggestSkills(task) exists but isn't auto-called in agent.js yet
- skills/*/scripts/ dirs are empty placeholders
- No UI surfacing yet of which skills/tools are active mid-run beyond the step log
- desktop skill entirely unverifiable in this sandbox (no display) — real test only possible on
  the user's actual machine; code paths per-OS are correct per each platform's standard CLI/API
  but haven't been run end-to-end anywhere with a real screen
- WebSocket reconnect/backoff UI indicator

## v5 additions
- package.json engines: node >=18; run.sh checks node major version, exits with install link if <18
- Dockerfile: node:22-alpine
- CI matrix: node 18/20/22
- vite.config.js: manualChunks (vendor, markdown) — fixes bundle-size warning
- routes/webhook.js: POST /api/webhook — GitHub webhook receiver. issues.opened → auto-label needs-triage. issues.labeled with label ai-fix → auto-runs contributor.solveIssue. HMAC verify via GITHUB_WEBHOOK_SECRET env (optional)
- To activate: repo Settings → Webhooks → Payload URL https://your-host/api/webhook, json, event: Issues

## v20 (native Gemini + multi-model reasoning + real audit — found & fixed an actual bug)
User asked to "check all, make it more advanced/capable" — did a genuine systematic audit
(not just adding features), documented here because it found something real.

### AUDIT METHOD (repeat this before claiming "everything works" in future)
1. `node -e require(...)` every service/route — catches syntax/import errors only
2. Boot the real server, curl every GET+POST route with real payloads — catches route/handler
   contract bugs `require()` can't see
3. Cross-referenced every frontend `fetch()` call string against every backend `router.*()`
   path — zero mismatches found
4. Unit-tested new translation logic with constructed inputs by placing a throwaway test file
   inside services/ (so relative requires resolve) rather than trusting require()-succeeds
5. **Live Socket.IO client test** (socket.io-client from frontend/node_modules — not a root
   dep) against a real running server — this is what REST/require checks miss, and it's what
   caught the real bug below

### REAL BUG FOUND AND FIXED: agent-start was never emitted on a fresh run
During the v18 skills-architecture refactor (runAgent/continueAgent/coreLoop split),
`socket.emit('agent-start', ...)` ended up ONLY inside `continueAgent()` (with `resumed:true`)
— never present in `runAgent()`. Effect: on every FRESH agent run, Agent.jsx's `agent-start`
listener (which sets `currentRunId`) never fired — the Stop button and post-stop Continue
button had no runId to target on a first run, only after a resume. Fixed: added the matching
`socket.emit('agent-start', { runId, task })` right after the DB insert in `runAgent()`.
Verified via live socket test: fires with a real runId on a fresh run; stop-agent/
agent-stop-ack round-trip using that runId works end-to-end. Lesson: after any future refactor
of the socket event surface, re-run the live socket test, not just require()/REST checks.

### Native Gemini integration (real API, verified against current docs)
- Installed `@google/genai` (real npm package)
- services/gemini.js: chat()/streamChat() match openrouter.js's signature exactly.
  toGeminiContents() translates full OpenAI-shape history — including past assistant
  tool_calls and tool-role results — into Gemini's contents[]/functionResponse format (tracks
  tool_call_id→name across the walk, since Gemini's functionResponse needs the name not an id).
  toGeminiTools() maps our tool defs to functionDeclarations (parametersJsonSchema accepts our
  JSON Schema directly). toUnifiedResponse() maps response.functionCalls back to our internal
  {tool_calls:[{id,function:{name,arguments}}]} shape — agent.js's coreLoop needs zero changes.
- services/openrouter.js: chat()/streamChat() check `gemini.isGeminiModel(model)` (matches bare
  `gemini-*`, NOT OpenRouter's `google/gemini-*` — confirmed no collision) before any
  OpenRouter-specific logic — delegates to gemini.js, falls back to the free OpenRouter pool if
  no Gemini key configured or the call fails. Every existing call site already goes through
  `require('./openrouter').chat/streamChat`, so this reaches the whole app with zero other
  files needing to change — deliberate choice to avoid missing a call site.
- rotation.js: parallel Gemini key pool (setGeminiKeys/getGeminiKey/rotateGemini), same pattern
  as OpenRouter's existing 3-key rotation. status() reports both.
- MODEL_PRESETS: added 🔷 gemini-3.5-flash/2.5-flash/2.5-pro (native) — auto-appear in every
  model picker with zero frontend changes (they just read models.presets).
- Settings.jsx: Gemini key rotation panel added; fixed a stale model-pool placeholder that
  still referenced removed paid models.
- .env.example: added GEMINI_API_KEY (optional).

### brain.crossCheck — multi-model reasoning
Asks the same question to several different free models in parallel (Promise.allSettled,
different providers = different failure modes/biases), then has one synthesize a final answer
noting agreement/disagreement. New agent tool `cross_check` (core, always available). SYSTEM
prompt's DECIDE step: routine tradeoffs → `decide`, high-stakes/irreversible → `cross_check`.

### Known gaps from this pass
- Gemini streaming tool-calls: simplified (flags sawToolCall, doesn't assemble partial
  function-call args across chunks) — fine since the Chat tab doesn't pass tools today, would
  need finishing if that changes
- suggestSkills(task) exists but isn't auto-called in agent.js yet
- desktop skill unverifiable in this sandbox (no display) — real test needs the user's machine


1. Read this file only — don't `ls`/`view` the whole repo again
2. Locate exact file(s) via map above
3. Use str_replace/python patch for small edits; only rewrite whole file if net-new
4. Update this file's "Decisions" / "Pending" sections when architecture changes
5. Build frontend + commit + push at the end, one shot

## v21 (security audit — command injection found and fixed across 6 tools)
User said "check it and fix it as you want" — extended the v20 audit method with a targeted
sweep for shell-injection risk: any tool where an agent-suppliable string gets interpolated
into a string passed to sh()/exec() (which runs via /bin/sh -c) rather than passed as a real
argv array. Grepped for the pattern, found 6 real instances, fixed all of them, then wrote
actual exploit-shaped payloads ("; touch /tmp/PWNED; echo " etc.) and confirmed via live
tools.execute() calls that they no longer break out — not just "looks safer," verified.

### Added: spawnCmd(bin, args, opts) helper in tools/index.js
Runs a binary with a real argv array via child_process.spawn (no shell:true) — arbitrary text
in args can never be interpreted as shell syntax, since no shell parses it at all. Preferred
over sh()/exec() any time the "unsafe" value is incidental data (keystrokes, a URL, a filename)
rather than being the deliberate command itself.

### Fixed (confirmed exploitable before, confirmed closed after — not just theoretical)
- open_url: now spawnCmd('xdg-open', [url]) instead of shell-string interpolation
- mouse_move/mouse_click: x/y Number()-coerced + isFinite-validated (fails closed), Linux/macOS
  use spawnCmd argv instead of shell strings
- keyboard_type/keyboard_key: Linux path now spawnCmd('xdotool',['type','--',str]) — real argv,
  fully immune. macOS/Windows still build an AppleScript/PowerShell string (required by those
  tools' own syntax) but execute via spawnCmd (no outer shell layer), removing the shell-
  metacharacter injection surface even though inner script-language escaping still applies there
- search_in_files / list_files (recursive): REWRITTEN ENTIRELY in pure Node (manual recursive
  walk + regex matching) instead of shelling out to grep/find — shell removed completely, not
  just escaped. Bonus: no longer depends on grep/find being installed, works on Windows too.
  Verified functionally correct (real files found, real module.exports matches with correct
  file:line output) AND verified an injection payload in `path` just fails as "not found."
- screen_screenshot (save_as) / create_project (name): sanitized to [^a-zA-Z0-9._-] -> _ before
  touching any shell string. create_project's generated file CONTENT still uses the original
  unsanitized name (correct — fs.writeFile never touches a shell); only the one line that does
  shell out (vite scaffold) needed the sanitized version, via projDir which was already correct.

### NOT changed (deliberately — these ARE "run an arbitrary command" tools by design)
bash/bash_interactive, git_terminal, open_app, npm_install/pip_install — same trust boundary as
a human typing into a terminal, not a bug. clipboard_copy reconfirmed already-safe (text goes
through stdin pipe, never touches the shell command string).

## v22 (webhook signature verification was silently broken — fixed)
Continued the audit pattern from v21. Found a second real correctness bug in routes/webhook.js's
GitHub webhook HMAC verification:

1. Wrong bytes hashed: express.json() in server.js had no verify callback, so req.body was the
   PARSED object. webhook.js computed the HMAC over JSON.stringify(req.body) — a re-
   serialization — not the original raw bytes GitHub actually signed. Key ordering/number
   formatting/escaping differences mean this would very likely never match a real GitHub
   webhook's signature once GITHUB_WEBHOOK_SECRET was configured — every legitimate delivery
   would have been silently rejected as "bad signature." With no secret set, verify() returns
   true unconditionally, which is exactly what was masking this — it only breaks once someone
   turns signature checking ON, which is precisely when it matters. Fixed: express.json() now
   takes verify:(req,res,buf)=>{req.rawBody=buf}, webhook.js hashes req.rawBody instead.
2. Timing-unsafe comparison: sig === expected is a plain string compare, vulnerable in
   principle to a timing attack. Fixed: crypto.timingSafeEqual() with an explicit length check
   first (timingSafeEqual throws rather than returning false on length-mismatched buffers, so
   the length check has to happen before calling it).

Verified against a REAL HMAC computed the same way GitHub computes it (raw JSON body -> HMAC-
SHA256 -> hex, sha256= prefix), via a real HTTP request to a running server: valid signature ->
200, tampered signature -> 401, missing signature -> 401. Confirms this was actually broken
before and genuinely works now.

## v23 (server-wide error handling — errors were returning HTML, could crash client-side)
Continued the audit. Checked every route file for unhandled-error risk (agent.js, memory.js,
models.js, rotation.js had no explicit try/catch, unlike the others which use a shared h()
wrapper). Conclusion: none of these could crash the whole Node PROCESS (all synchronous
db calls that Express 4 catches automatically, or internally-guarded async like getModels()) -
but a real, separate bug: any error that DID occur returned Express's default HTML error page,
and every frontend fetch() call does .then(r => r.json()) with no r.ok check - meaning any
backend error would crash client-side with a confusing "Unexpected token <" instead of ever
showing the real message. Verified real: corrupted an agent_runs.steps field, hit GET
/api/agent/runs/:id, confirmed it returned an HTML page before the fix.

Fixed in server.js:
- Global Express error-handling middleware (4-arg signature, registered after all route
  mounts) - converts ANY error reaching it into {error: message} JSON instead of HTML.
  Verified with the same corrupted-steps test: now returns Content-Type: application/json,
  status 500, {"error":"Unexpected token 'N', ..."} - the real underlying error message,
  properly JSON-parseable by the frontend.
- process.on('unhandledRejection'/'uncaughtException') - log and keep running instead of
  Node's default behavior of terminating the whole process on an unhandled async rejection
  anywhere (a route, a socket handler, a background timer). One bad request should never take
  the server down for every other session.

Verified no regression: normal GET /api/models and /api/agent/runs still return 200 after
adding the middleware.

## v24 (real automated test suite — turns manual audits into something that runs itself)
User invited open-ended upgrades. Highest-leverage addition: every manual verification done
across v20-v23 (module loads, skill/tool wiring consistency, injection-payload regression,
Gemini translation correctness, webhook HMAC against a real signature, REST contracts, live
Socket.IO agent lifecycle) is now codified as an actual test suite instead of living only in
chat history / one-off scripts I re-derive each session.

- tests/*.test.js using node:test + node:assert (built into Node 18+, zero new dependency)
- tests/_server-helper.js: fork()'s a real server.js child process on a dedicated test port
  (3099, avoids clashing with a dev server on 3001), waits for the real startup banner before
  resolving. startServer(env, {clean:false}) lets a test seed data/store.json and restart
  without the helper's normal data-dir wipe stepping on the fixture — found and fixed this
  exact bug in the test helper itself while building it (first run: 404 instead of 500 because
  the corrupted-fixture file was being deleted by the next startServer() call before the
  restarted server could read it).
- tests/modules.test.js: every service/route requires cleanly
- tests/skills.test.js: every skill's declared tools resolve to real T{} implementations (loops
  all 6 skills, not just one), github-pr-workflow correctly cascades to include git+github,
  core tool set has zero overlap with any skill-owned tool
- tests/security.test.js: the actual exploit payloads from the v21 audit
  ('"; touch /tmp/PWNED; echo "') run against keyboard_type/open_url/mouse_move/
  search_in_files and assert the marker file was never created — this is the regression test
  that would catch it if someone ever reintroduces shell-string interpolation here
- tests/gemini.test.js: exported the pure translation functions (toGeminiContents/
  toGeminiTools/toUnifiedResponse) from services/gemini.js properly instead of the eval-hack
  used to test them manually in v20 — unit tests now check exact translated shapes
- tests/webhook.test.js: the real HMAC-computed-the-way-GitHub-does test from v22, codified
- tests/api.test.js: REST contract + the "errors return JSON not HTML" regression test from v23
- tests/socket.test.js: live Socket.IO test that agent-start fires with a real runId on a FRESH
  run — this is the exact regression test for the v20 bug

Wired: package.json `"test": "node --test \"tests/**/*.test.js\""` (bare `node --test tests/`
resolves tests/ as a module path and fails on this Node version — glob form is required).
.github/workflows/ci.yml reordered: installs frontend deps BEFORE running tests (socket.test.js
needs frontend/node_modules/socket.io-client) and BEFORE building, runs `npm test` as a real CI
gate now instead of just a `require()` smoke check.

Full suite: 65/65 passing. README.md and SETUP.md updated to reflect actual current
capabilities (skills architecture, desktop control, native Gemini, cross_check, learned skills,
test suite) — README had drifted stale since v17-era wording.

## v25 (verified the core promise end-to-end + made it genuinely "living")
User asked to check whether "fix issue X in repo Y" actually flows through analysis->plan->
decide->fix->PR, and to add real autonomous/"living" capability. Two real pieces of work:

### 1. contributor.solveIssue() closed a real gap: plan/decide were never explicit
Traced the full existing pipeline (it's real, not mocked - reads the actual repo tree, picks
relevant files via LLM, reads their real content, generates a fix via a strict parseable
file-block format, opens a real branch+PR). But it jumped straight from "read files" to
"generate the whole fix" in ONE call - no separate plan or decision artifact, which doesn't
match "analysis, plan, decisions, then fix." Added a genuine planning step between them: a
dedicated LLM call producing {root_cause, approach, files_to_change, risks, confidence} JSON,
logged visibly (so the user watching a run sees the actual reasoning, not just the end result),
and fed into the fix-generation prompt as guidance rather than starting cold. Plan is now part
of the returned result and the logged contribution history entry.
Note: the AGENT tab's general natural-language path (typing "fix the issue about X in owner/
repo") already goes through the full think/make_plan/decide/activate_skill loop via agent.js's
SYSTEM prompt + github-pr-workflow skill - that path was already correct. This fix specifically
closes the gap in the FAST single-shot path (Contribute tab's one-click button, and the watcher
below), which is a deliberately different, faster pipeline but needed its own real plan step.

### 2. services/watcher.js — genuine autonomous/"living" agent capability (new)
Previously the ONLY autonomous trigger was routes/webhook.js, which requires GitHub to be able
to reach a public URL - unusable for anyone running this locally without ngrok/a public host.
watcher.js polls configured owner/repo pairs on an interval (default 15min, 5min floor),
checks for issues labeled `ai-fix` (same label convention as the webhook path, so behavior is
consistent regardless of which trigger fired), and calls contributor.solveIssue() automatically.
Tracks processedIssues per repo (persisted to data/watcher.json) so nothing gets solved twice,
verified this survives a server restart. startScheduler() runs in server.js on boot (checks
every 60s whether intervalMinutes has elapsed since last fire - gated interval, not a raw
setInterval at the configured minutes, so changing the interval takes effect without a restart).

routes/watcher.js: GET /status, POST /enabled, POST /interval, POST /model, POST/DELETE /repos,
POST /run-now. Settings.jsx: new "🟢 Live Agent" panel (on/off toggle, interval, watched-repo
list, check-now button, recent activity log) - this is the primary UI surface for the "living
agent" framing, sits above the Web LLMs panel.

### VERIFIED LIVE against the real GitHub API (api.github.com is reachable from this sandbox,
unlike openrouter.ai/generativelanguage.googleapis.com) - not just unit tests:
- Created a real test issue on yuvrajlaptop2008-byte/ai-dev-agent labeled ai-fix
- Ran the watcher's run-now against it: log correctly showed "🔍 Found ai-fix issue #1..."
  (detection genuinely works against real GitHub), then attempted solveIssue which failed only
  at the OpenRouter call (403 - this sandbox's network restriction, not a code bug; works on a
  real machine with real network access) - failure was caught and logged cleanly, did not
  crash anything
- Ran run-now a second time: issue #1 was correctly NOT re-detected (dedup persisted across
  the server restart between the two test runs) - verified via data/watcher.json state
- Closed the test issue afterward, cleaned up

tests/watcher.test.js: config round-trip (enable/disable, interval clamping to 5min floor,
add/remove repos without duplicates, removeRepo clears that repo's processed-issue history),
runOnce() with zero watched repos returns immediately. 7 new tests, suite now 72/72.
