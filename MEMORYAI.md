# MEMORYAI — Project State (read this first, skip re-exploring repo)

## v18 — FULL RECREATION on Hermes Agent core (breaking change from v1-v17)
Previous v1–v17 was a custom Node.js/Express/React app built from scratch. Per explicit user
instruction, that was discarded entirely and replaced with the real, upstream **Hermes Agent**
(github.com/NousResearch/hermes-agent, MIT licensed, ~0.18.2) codebase — a mature, self-improving
Python agent — configured for this user. Old Node.js history is still in git log if ever needed,
but the current tree is Hermes-derived. Do not try to merge old and new architectures.

## What was kept from upstream Hermes vs stripped
KEPT (the actual functional core): agent/, gateway/, providers/, plugins/, skills/, optional-skills/,
optional-mcps/, hermes_cli/, ui-tui/, web/, tui_gateway/, acp_adapter/, acp_registry/, cron/, docker/,
scripts/, tools/, and top-level entry files (cli.py, run_agent.py, hermes_*.py, pyproject.toml,
package.json, LICENSE, AGENTS.md).
STRIPPED (not needed to run the agent): tests/ (32M), website/ (27M marketing site), apps/ (22M Tauri
desktop shell), locales/ (i18n translations), nix/, packaging/homebrew/, .github/ (Nous's own release
CI, not portable to this fork), assets/ (banner images).
Verified: pip install -e . succeeds clean, `hermes --help` and `hermes doctor` both run correctly,
py_compile passes on core entry points. This is a genuinely working install, not just copied files.

## Entry points (from pyproject.toml [project.scripts])
- `hermes` → hermes_cli.main:main — the main CLI (chat, setup, model, gateway, cron, skills, etc.)
- `hermes-agent` → run_agent.py:main
- `hermes-acp` → acp_adapter/entry.py:main

## Config architecture (real, verified against actual hermes_cli/config.py code — not guessed)
- Secrets: `.env` at repo root (OPENROUTER_API_KEY, GITHUB_TOKEN required; SERPER_API_KEY/ZAI_API_KEY/
  GOOGLE_API_KEY optional) — loaded via `set -a; source .env` in run.sh before launching.
- Runtime config: `~/.hermes/config.yaml` (or `$HERMES_HOME/config.yaml`) — model.provider/model.default,
  fallback_model, security, etc. Seeded on first run from `config-template/config.yaml` (generated via
  the real `hermes_cli.config.save_config()` call, not hand-written YAML).
- Persona: `~/.hermes/SOUL.md`, seeded from `config-template/SOUL.md`.
- Default model: `meta-llama/llama-3.3-70b-instruct:free` via openrouter provider. Fallback:
  `deepseek/deepseek-chat-v3-0324:free`. Both free — change anytime with `hermes model`.

## run.sh (the ONE command setup)
Idempotent: creates .venv if missing, pip installs (marked done via .venv/.installed sentinel so it
only happens once), creates .env from .env.example and STOPS if .env is still template values (user
must add real keys), seeds ~/.hermes on first real run, then execs `hermes "$@"` — so `bash run.sh`
alone opens interactive chat, `bash run.sh doctor` runs doctor, etc. Verified end-to-end in a clean
simulated HOME — full install → doctor → correct config detection all passed.

## GitHub capability
Built into upstream: skills/github/ has github-auth, github-code-review, github-issues,
github-pr-workflow, github-repo-management, codebase-inspection sub-skills. Don't rebuild GitHub
tooling from scratch — it's already there and more complete than what v1-v17 hand-built in Node.

## User Communication Preference (CRITICAL — always follow, carried over from prior architecture)
- Zero narration. No "I'm going to...", no step explanations, no "done!" summaries unless asked.
- Work silently, decide autonomously, use full judgment.
- Only output what's required: files/commands the user must act on, or direct answers.
- Minimize tokens always.
- Maintain this file instead of re-scanning the repo on future requests.

## Known gaps / next things to check if asked to continue this
- ui-tui/ and web/ have their own package.json — not yet npm installed/tested (Python core is what's
  verified; JS-side TUI/web assets are copied but unverified in this pass).
- No CI configured yet (old Nous .github workflows were release/signing infra specific to their repo,
  intentionally not ported — a minimal test-on-push workflow could be added if wanted).
- optional-skills/ and optional-mcps/ are present but not auto-enabled — check hermes_cli tools/skills
  subcommands for how upstream expects them to be turned on.
- GLM/z.ai fallback provider is supported natively (ZAI_API_KEY) — matches what was hand-built in the
  old Node version's webllm.js; that hand-rolled browser-session approach is now obsolete, prefer the
  native provider.
