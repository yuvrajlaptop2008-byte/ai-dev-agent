# ⚡ ARIA — Autonomous AI Dev Agent

Fully autonomous coding agent: solves GitHub issues, ships whole projects, researches the web, drives VS Code, and talks to Claude/ChatGPT/Gemini through your own logged-in browser session — 100% free-model powered via OpenRouter.

## What it does
- **Runs until done.** No iteration cap — works until the task is verifiably complete, or you hit Stop.
- **Full GitHub control.** Issues, PRs, branches, releases, CI, repo settings, collaborators, delete/archive/transfer — treats your account as its workspace.
- **Ships real projects.** One idea in → architecture, code, tests, README, LICENSE, CI, all pushed to a brand-new repo.
- **Researches like a human.** Live web search, multi-page synthesis, NPM/PyPI lookups, doc reading.
- **Deep VS Code integration.** Opens files, configures debugging/tasks/settings, installs extensions, scaffolds workspaces.
- **Browser + OS control.** Puppeteer automation, opens apps/URLs, creates files/folders on your machine.
- **Free models only.** 65+ free OpenRouter models, auto key rotation (up to 3 keys), auto fallback on rate limits/errors.
- **Talks to other AIs.** Optional: log into claude.ai / chatgpt.com / gemini.google.com once, ARIA can consult them for a second opinion — no API key needed.
- **Remembers.** Persistent condensed memory across sessions; caches repo reads and research to save tokens/time.

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
| Agent | Give it any task, pick Deep/Fast mode, watch it work, Stop anytime |
| Chat | Direct streaming chat, any free model |
| Research | Deep think / plan / decide / web research on demand |
| GitHub | Browse issues, PRs, branches, commits |
| Contribute | One-click: solve issue, improve README, write tests, add CI, build new project |
| VS Code | Open files, scaffold projects, manage extensions/configs |
| Terminal | Full shell access |
| MCP | Connect external tool servers |
| Settings | Keys, model rotation, Web-LLM logins, memory viewer |

## License
MIT
