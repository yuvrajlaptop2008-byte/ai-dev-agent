# ⚡ ARIA (Hermes Agent core)

A self-improving autonomous AI agent — creates skills from experience, improves them during use, and manages GitHub like a human engineer. Built on the [Hermes Agent](https://github.com/NousResearch/hermes-agent) core by Nous Research (MIT licensed), configured here to run entirely on free OpenRouter models.

## What it does
- **Learns.** Creates and refines its own skills from what it does; searches its own past sessions; builds a model of you across conversations.
- **Full GitHub mastery.** Issues, PRs, branches, releases, code review, repo management — via the built-in `skills/github/` suite plus raw git/shell.
- **Runs anywhere.** Local, Docker, SSH, or serverless (Modal/Daytona) backends.
- **Lives where you do.** CLI, Telegram, Discord, Slack, WhatsApp, Signal — one gateway process.
- **Any model, free by default.** Routes through OpenRouter; ships pointed at free models (`meta-llama/llama-3.3-70b-instruct:free` primary, `deepseek/deepseek-chat-v3-0324:free` fallback). Swap anytime with `hermes model`.
- **Scheduled automation.** Built-in cron for unattended daily/weekly jobs.
- **Parallel work.** Spawns subagents for isolated workstreams.

## Setup
```bash
git clone https://github.com/yuvrajlaptop2008-byte/ai-dev-agent.git
cd ai-dev-agent
bash run.sh
```
First run creates `.env` and stops — add your keys, then run `bash run.sh` again:
```
OPENROUTER_API_KEY=...   # https://openrouter.ai/keys
GITHUB_TOKEN=...         # https://github.com/settings/tokens/new (repo, workflow scopes)
```
That's it — `run.sh` handles the venv, install, and first-run config seeding every time.

## Daily use
```bash
hermes                # interactive chat
hermes setup          # reconfigure anything
hermes model          # switch model/provider
hermes gateway setup  # wire up Telegram/Discord/Slack/etc
hermes cron           # schedule recurring jobs
hermes doctor         # health check
```

Requires Python 3.11–3.13 and Node.js (for the TUI/web assets).

## License
MIT — original Hermes Agent core © Nous Research. See [LICENSE](LICENSE).
