/**
 * BROWSER - Real web research, scraping, reading websites
 */
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── FETCH & PARSE PAGE ───────────────────────────────────
async function fetchPage(url, options = {}) {
  try {
    const r = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/json,*/*', 'Accept-Language': 'en-US,en;q=0.9', ...(options.headers || {}) },
      timeout: options.timeout || 20000,
      maxRedirects: 5,
      responseType: 'arraybuffer'
    });
    const contentType = r.headers['content-type'] || '';
    const text = r.data.toString('utf8');

    if (contentType.includes('json')) {
      return { url, type: 'json', content: JSON.stringify(JSON.parse(text), null, 2).slice(0, 10000) };
    }

    const $ = cheerio.load(text);
    // Remove noise
    $('script, style, nav, footer, .advertisement, .ads, #cookie-banner, .popup, iframe').remove();

    const title = $('title').text().trim();
    const meta = $('meta[name="description"]').attr('content') || '';

    // Extract main content intelligently
    let content = '';
    const selectors = ['main', 'article', '.content', '.post', '.article-body', '#content', '.main-content', 'body'];
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        content = el.text().replace(/\s+/g, ' ').trim();
        break;
      }
    }
    if (!content) content = $('body').text().replace(/\s+/g, ' ').trim();

    // Extract links
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const txt = $(el).text().trim();
      if (href && txt && href.startsWith('http') && links.length < 20) links.push({ text: txt, url: href });
    });

    // Extract code blocks
    const codeBlocks = [];
    $('pre, code').each((_, el) => {
      const code = $(el).text().trim();
      if (code.length > 20 && codeBlocks.length < 5) codeBlocks.push(code.slice(0, 1000));
    });

    return { url, title, meta, type: 'html', content: content.slice(0, 12000), links: links.slice(0, 15), codeBlocks };
  } catch (e) {
    return { url, error: e.message, content: '' };
  }
}

// ─── MULTI-ENGINE SEARCH ──────────────────────────────────
async function search(query, num = 8) {
  const results = [];

  // 0. Serper.dev (real Google results) - primary if key set
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    try {
      const r = await axios.post('https://google.serper.dev/search', { q: query, num }, {
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }, timeout: 10000
      });
      if (r.data.answerBox) results.push({ source: 'Google-Answer', title: r.data.answerBox.title || 'Answer', snippet: r.data.answerBox.answer || r.data.answerBox.snippet, url: r.data.answerBox.link || '' });
      (r.data.organic || []).forEach(o => results.push({ source: 'Google', title: o.title, snippet: o.snippet, url: o.link }));
      if (results.length) return results.slice(0, num);
    } catch {}
  }

  // 1. DuckDuckGo instant answers
  try {
    const r = await axios.get('https://api.duckduckgo.com/', {
      params: { q: query, format: 'json', no_redirect: '1', no_html: '1', skip_disambig: '1' },
      headers: { 'User-Agent': UA }, timeout: 8000
    });
    const d = r.data;
    if (d.AbstractText) results.push({ source: 'DDG-Instant', title: d.Heading, snippet: d.AbstractText, url: d.AbstractURL });
    if (d.Answer) results.push({ source: 'DDG-Answer', title: 'Answer', snippet: d.Answer, url: '' });
    (d.RelatedTopics || []).slice(0, 5).forEach(t => {
      if (t.Text && t.FirstURL) results.push({ source: 'DDG-Related', title: t.Text.slice(0, 80), snippet: t.Text, url: t.FirstURL });
    });
  } catch {}

  // 2. DuckDuckGo HTML search
  try {
    const r = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query, s: '0' },
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      timeout: 10000
    });
    const $ = cheerio.load(r.data);
    $('.result').slice(0, 8).each((_, el) => {
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const url = $(el).find('.result__url').text().trim();
      if (title && snippet) results.push({ source: 'DDG-Search', title, snippet, url: url.startsWith('http') ? url : `https://${url}` });
    });
  } catch {}

  return results.slice(0, num);
}

// ─── DEEP RESEARCH ────────────────────────────────────────
async function deepResearch(query, depth = 2) {
  const report = { query, timestamp: new Date().toISOString(), searchResults: [], pageContents: [], summary: '' };

  // Search
  report.searchResults = await search(query, 8);

  // Fetch top pages
  if (depth >= 2) {
    const urls = report.searchResults.filter(r => r.url && r.url.startsWith('http')).slice(0, 3).map(r => r.url);
    const pages = await Promise.allSettled(urls.map(u => fetchPage(u, { timeout: 15000 })));
    pages.forEach(p => { if (p.status === 'fulfilled' && !p.value.error) report.pageContents.push(p.value); });
  }

  return report;
}

// ─── GITHUB/NPM/PYPI RESEARCH ─────────────────────────────
async function searchNPM(query) {
  try {
    const r = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`, { timeout: 8000 });
    return r.data.objects.map(o => ({ name: o.package.name, description: o.package.description, version: o.package.version, url: o.package.links?.npm }));
  } catch { return []; }
}

async function searchPyPI(query) {
  try {
    const r = await axios.get(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`, { timeout: 8000 });
    const info = r.data.info;
    return [{ name: info.name, description: info.summary, version: info.version, url: info.project_url }];
  } catch { return []; }
}

async function fetchGitHubReadme(owner, repo) {
  try {
    const r = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`, { timeout: 10000 });
    return r.data.slice(0, 6000);
  } catch {
    try {
      const r = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`, { timeout: 10000 });
      return r.data.slice(0, 6000);
    } catch { return ''; }
  }
}

async function fetchDocs(url) {
  return fetchPage(url, { timeout: 20000 });
}

// ─── SCREENSHOT (text-based) ──────────────────────────────
async function siteSnapshot(url) {
  const page = await fetchPage(url);
  return {
    url,
    title: page.title,
    description: page.meta,
    mainContent: page.content?.slice(0, 3000),
    links: page.links?.slice(0, 10),
    hasCode: (page.codeBlocks?.length || 0) > 0,
    codeSnippets: page.codeBlocks?.slice(0, 2)
  };
}

module.exports = { fetchPage, search, deepResearch, searchNPM, searchPyPI, fetchGitHubReadme, fetchDocs, siteSnapshot };
