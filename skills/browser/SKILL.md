---
name: browser
description: Real browser automation — navigate, click, type, scroll, screenshot, extract data, handle logins and forms.
keywords: browser, click, navigate, screenshot, automate, form, login, scrape, website
tools: browser_automate, fetch_url, read_website
---

# Browser Skill

Drives a real headless browser (Puppeteer) for anything that needs actual page interaction,
not just reading static HTML.

## Capabilities
Open websites · search · fill forms · login · click buttons · scroll · read page text ·
download files · upload files · screenshot · execute JavaScript · wait for elements ·
handle popups · navigate tabs · read DOM · extract structured data.

## Typical action sequence
```
Open Browser → Navigate URL → Wait → Find Element → Click → Type → Read → Extract → Save
```

## Tools
- `browser_automate(url, actions[])` — real interaction: `{type:"click"|"type"|"wait"|"screenshot", selector, text, ms}`
- `fetch_url(url)` — fast path for static pages/APIs/raw files, no browser needed (prefer this
  when you just need to read content — cheaper and faster than a real browser)
- `read_website(url)` — structured snapshot (title, links, code blocks) for planning

## When to use browser_automate vs fetch_url
Use `fetch_url` by default — it's fast and doesn't need a display. Only reach for
`browser_automate` when the page requires JS rendering, login, clicking, or form submission
that a plain HTTP fetch can't do.
