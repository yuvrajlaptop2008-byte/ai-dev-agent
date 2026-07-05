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
