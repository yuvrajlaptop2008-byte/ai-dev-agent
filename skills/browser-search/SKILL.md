---
name: browser-search
description: Research the web — search, collect sources, read pages, extract facts, synthesize, cite.
keywords: research, search, find information, look up, investigate, sources
tools: web_search, deep_research, fetch_docs, search_npm, search_pypi, fetch_github_readme, fetch_api
---

# Browser Search / Research Skill

## Workflow
```
Search → Collect Links → Open Page → Extract Information → Summarize → Cite Sources
```

## Tools
- `web_search(query)` — quick multi-source search (Serper/Google if configured, DuckDuckGo fallback)
- `deep_research(topic, depth)` — search + actually reads the top pages + synthesizes a real
  answer with sources, not just snippets. Use this over `web_search` when the answer needs
  real depth, not a quick fact.
- `search_npm(query)` / `search_pypi(query)` — package research before reinventing something
- `fetch_github_readme(owner, repo)` — understand a library from its actual docs
- `fetch_docs(url)` / `fetch_api(url)` — read specific documentation or hit an API directly

## Discipline
- Always cite where a claim came from when reporting research back.
- Prefer `deep_research` for anything the final answer depends on being *correct*, not just
  plausible — one `web_search` snippet is not enough to build a decision on.
- For fast-moving topics (current events, latest versions, current status of something),
  always search — don't answer from training knowledge alone.
