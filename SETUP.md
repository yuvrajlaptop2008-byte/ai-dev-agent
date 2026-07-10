# ARIA — Setup Guide

## 1. Clone
```bash
git clone https://github.com/yuvrajlaptop2008-byte/ai-dev-agent.git
cd ai-dev-agent
```

## 2. Requirements
- Node.js 18, 20, or 22 → https://nodejs.org (LTS recommended)
- Check: `node -v`

## 3. Configure keys
```bash
cp .env.example .env
```
Edit `.env`:
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
PORT=3001
```
- GitHub token: https://github.com/settings/tokens/new → scopes: `repo`, `workflow`
- OpenRouter key: https://openrouter.ai/keys

## 4. Run (one command)
```bash
bash run.sh
```
This installs deps, builds the frontend, and starts the server automatically.

## 5. Open
```
http://localhost:3001
```

## 6. (Optional) GitHub Webhook — auto-respond to issues
1. Repo → Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain/api/webhook`
3. Content type: `application/json`
4. Events: **Issues**
5. In `.env` add: `GITHUB_WEBHOOK_SECRET=your_secret` (must match webhook secret)

Behavior:
- New issue opened → auto-labeled `needs-triage`
- Add label `ai-fix` to any issue → ARIA automatically researches, fixes, and opens a PR

## 7. Daily use
- **Agent tab** → give any task, pick a model (free or paid), it runs autonomously
- **Contribute tab** → point at any repo, click "Find Issues" or "Solve Issue"
- **Settings tab** → switch model, click "Refresh Model List" to pull latest OpenRouter models
