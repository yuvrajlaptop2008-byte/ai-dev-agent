# ⚡ ARIA — Autonomous AI Dev Agent

A fully autonomous coding agent: solves GitHub issues, ships whole projects, researches the web, drives VS Code, controls the desktop, and talks to Claude/ChatGPT/Gemini through your own logged-in browser session — free-model powered by default, with native Gemini support too.

## What it does
- **Runs until done.** No iteration cap — works until the task is verifiably complete, or you hit Stop. Every run is resumable: hit Continue after a stop and it picks up with full context and tool access intact.
- **On-demand skills.** Loads git/GitHub/browser/desktop tools only when the task needs them (`activate_skill`) — cheap on simple asks, fully capable the moment it matters. `github-pr-workflow` bundles the whole branch→code→test→commit→push→PR loop.
- **Full GitHub control.** Issues, PRs, branches, releases, CI, repo settings, collaborators, delete/archive/transfer — treats your account as its workspace.
- **Ships real projects.** One idea in → architecture, code, tests, README, LICENSE, CI, all pushed to a brand-new repo.
- **Sees and controls the screen.** Real screenshots described via vision AI, real mouse/keyboard input — not simulated.
- **Multi-model reasoning.** Free OpenRouter models with auto key rotation and fallback, plus native Gemini (own key rotation too). For genuinely high-stakes decisions, `cross_check` queries several different models in parallel and reconciles their answers.
- **Learns.** Extracts a reusable "skill" from every completed task and recalls relevant ones before similar future work — visible in Settings.
- **Talks to other AIs.** Optional: log into claude.ai / chatgpt.com / gemini.google.com / aistudio.google.com / chat.z.ai once, ARIA can consult them directly — no API key needed for those.
- **Sounds like an engineer, not a search box.** Direct, warm, opinionated conversational tone in Chat; task-focused and relentless in Agent mode.

## Quick start
```bash
git clone https://github.com/yuvrajlaptop2008-byte/ai-dev-agent.git
cd ai-dev-agent
cp .env.example .env   # add GITHUB_TOKEN + OPENROUTER_API_KEY
bash run.sh
```
Open `http://localhost:3001`. Full guide: [SETUP.md](SETUP.md).

## Interface
| Tab | Purpose |
|---|---|
| Agent | Give it any task, pick Deep/Fast mode, watch it work, Stop/Continue anytime |
| Chat | Direct streaming chat, any free or native-Gemini model |
| Research | Deep think / plan / decide / cross-check / web research on demand |
| GitHub | Browse issues, PRs, branches, commits |
| Contribute | One-click: solve issue, improve README, write tests, add CI, build new project, strengthen your whole profile |
| VS Code | Open files, scaffold projects, manage extensions/configs |
| Terminal | Full shell access |
| MCP | Connect external tool servers |
| Settings | Keys, model + Gemini rotation, Web-LLM logins, memory & learned-skills viewer |

## Testing
```bash
npm test
```
Real test suite (`node --test`, no extra dependency) covering module integrity, skill/tool
wiring consistency, command-injection regression tests, Gemini message-translation correctness,
webhook HMAC verification against real GitHub-shaped signatures, REST API contracts, and live
Socket.IO agent lifecycle (start/stop/continue). Runs in CI on every push.

## License
MIT
