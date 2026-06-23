# ⚡ AI Dev Agent

Autonomous AI coding agent with GitHub integration, MCP support, and multi-model switching.

## Features
- 💬 **Chat** — Streaming chat with any OpenRouter model
- 🤖 **Autonomous Agent** — Solves GitHub issues, writes PRs, plans projects end-to-end
- 🐙 **GitHub Integration** — Browse repos, view/comment on issues, create PRs
- 🔌 **MCP Integration** — Connect any Model Context Protocol server
- 🔄 **Multi-model switching** — Switch between Claude, GPT-4, Gemini, DeepSeek, and 200+ models
- 💾 **Persistent memory** — SQLite-backed conversation history and settings
- ⚡ **Real-time streaming** — WebSocket-based token streaming

## Quick Start

```bash
git clone https://github.com/yuvrajlaptop2008-byte/ai-dev-agent
cd ai-dev-agent
cp .env.example .env
# Edit .env with your API keys
npm install
cd frontend && npm install && npm run build && cd ..
npm start
```

Open http://localhost:3001

## Environment Variables

```
OPENROUTER_API_KEY=your_key
GITHUB_TOKEN=your_token
PORT=3001
```

## Agent Capabilities

The agent can:
1. **Solve GitHub Issues** — Read issue, research solution, write code fix, create PR
2. **Code Review** — Analyze code for bugs, security, performance
3. **Project Planning** — Break down complex features into actionable steps
4. **Research** — Search web, find docs, analyze codebases
5. **Test Generation** — Write tests for any codebase
6. **Documentation** — Auto-generate docs from code

## MCP Integration

Add any MCP-compatible server in the MCP tab. Supports SSE, Stdio, and WebSocket transport.

## Model Support (via OpenRouter)
- Claude 3.5 Sonnet / Opus
- GPT-4o / GPT-4o-mini
- Gemini Pro 1.5
- DeepSeek Coder
- Llama 3.1 70B
- Mixtral 8x7B
- Qwen 2.5 Coder
- Codestral
- 200+ more models
