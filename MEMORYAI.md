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

## v17 (GLM/z.ai provider, self-evolving skill memory, fixed a leftover paid-model bug)
- webllm.js: added glm provider (chat.z.ai, best-effort selectors like the others). SITES now: claude/chatgpt/gemini/aistudio/glm. Settings.jsx provider list, ask_web_llm/webllm_login tool descriptions updated to match.
- BUGFIX: brain.js selectBestModel() still referenced paid models (deepseek-coder-v2 no :free, anthropic/claude-3-opus, anthropic/claude-3-haiku) — normalizeModel() in openrouter.js silently caught these but it was sloppy/wrong. Rewritten fully free-only.
- REAL FEATURE — self-evolving skill memory (brain.js): learnSkill(task, outcome, model) extracts {skill_name, applies_to, approach, pitfalls, tools_used, keywords} via LLM after a task and saves to memory category 'skills'. getRelevantSkills(task) keyword-matches against saved skills, returns top matches, and increments their `uses` counter each time they're recalled (reinforcement — more-used skills surface as more battle-tested). skillsSummary() lists all learned skills sorted by usage.
- agent.js: runAgent() now injects "relevant experience from past similar tasks" into fresh (non-fast) runs before the task starts, using getRelevantSkills(). On successful completion (status 'done', >2 iterations) fires brain.learnSkill() in the background (non-blocking, failure-safe) — this is the actual learn→recall→reinforce loop, not just a design intent.
- New agent tools: learn_skill (explicit save), recall_skills (explicit check) — for when the agent wants to consult/store learning mid-task itself, on top of the automatic hook.
- SYSTEM prompt: new "LEARNING" section explaining the skill memory to the agent itself.
- Settings.jsx: new "🎓 Learned Skills" panel — shows every learned skill, its approach, pitfalls, and use-count. This is the visible "growing over time" the user can watch happen.
- routes/brain.js: GET /skills

## Pending / Ideas Not Yet Built
- WebSocket reconnect/backoff UI indicator

## v5 additions
- package.json engines: node >=18; run.sh checks node major version, exits with install link if <18
- Dockerfile: node:22-alpine
- CI matrix: node 18/20/22
- vite.config.js: manualChunks (vendor, markdown) — fixes bundle-size warning
- routes/webhook.js: POST /api/webhook — GitHub webhook receiver. issues.opened → auto-label needs-triage. issues.labeled with label ai-fix → auto-runs contributor.solveIssue. HMAC verify via GITHUB_WEBHOOK_SECRET env (optional)
- To activate: repo Settings → Webhooks → Payload URL https://your-host/api/webhook, json, event: Issues

## Workflow For Future Requests
1. Read this file only — don't `ls`/`view` the whole repo again
2. Locate exact file(s) via map above
3. Use str_replace/python patch for small edits; only rewrite whole file if net-new
4. Update this file's "Decisions" / "Pending" sections when architecture changes
5. Build frontend + commit + push at the end, one shot
