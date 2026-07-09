/**
 * WEBLLM - Drive Claude.ai / ChatGPT / Gemini / Google AI Studio through a real
 * logged-in browser session (persistent profile), no API key/cost. First run
 * needs a manual login once; session cookies persist in ./data/browser-profile/<provider>.
 */
const path = require('path');
const fs = require('fs');

const PROFILE_ROOT = path.join(__dirname, '../data/browser-profile');
const SITES = {
  claude:   { url: 'https://claude.ai/new',                    input: 'div[contenteditable="true"]', response: '.font-claude-message' },
  chatgpt:  { url: 'https://chatgpt.com/',                      input: '#prompt-textarea',             response: 'div[data-message-author-role="assistant"]' },
  gemini:   { url: 'https://gemini.google.com/app',             input: 'div[contenteditable="true"]',  response: 'message-content' },
  aistudio: { url: 'https://aistudio.google.com/app/prompts/new_chat', input: 'textarea',               response: 'ms-chat-turn:last-of-type .turn-content', modelHint: 'Gemma' },
};

let _puppeteer = null;
function getPuppeteer() {
  if (_puppeteer) return _puppeteer;
  try { _puppeteer = require('puppeteer'); return _puppeteer; }
  catch { return null; }
}

function siteOf(provider) {
  const site = SITES[provider];
  if (!site) throw new Error(`Unknown provider: ${provider}. Use claude, chatgpt, gemini, or aistudio.`);
  return site;
}

async function launch(provider, headless) {
  const puppeteer = getPuppeteer();
  if (!puppeteer) throw new Error('puppeteer not installed — run: npm install puppeteer');
  const userDataDir = path.join(PROFILE_ROOT, provider);
  fs.mkdirSync(userDataDir, { recursive: true });
  return puppeteer.launch({ headless: headless ? 'new' : false, userDataDir, args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'] });
}

// Opens a real visible window so the user can log in once. Session persists after.
async function openLoginWindow(provider) {
  const site = siteOf(provider);
  const browser = await launch(provider, false);
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { message: `Browser window opened for ${provider}. Log in manually, then session is saved for future headless use.`, keepOpen: true, browser };
}

async function selectModel(page, modelHint) {
  if (!modelHint) return;
  // Best-effort: AI Studio's model picker is a dropdown; UI selectors change over time.
  try {
    const trigger = await page.$('[aria-label*="model" i], button:has-text("Model")').catch(() => null);
    if (trigger) {
      await trigger.click();
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate((hint) => {
        const opts = Array.from(document.querySelectorAll('[role="option"], mat-option, li'));
        const match = opts.find(o => o.textContent && o.textContent.toLowerCase().includes(hint.toLowerCase()));
        if (match) match.click();
      }, modelHint);
    }
  } catch { /* non-fatal — proceeds with whatever model is already selected */ }
}

// Sends a prompt using the saved logged-in session (headless) and returns the reply text.
async function ask(provider, prompt, timeoutMs = 60000) {
  const site = siteOf(provider);
  const browser = await launch(provider, true);
  try {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });

    const inputEl = await page.$(site.input).catch(() => null);
    if (!inputEl) throw new Error(`Not logged in to ${provider}. Call webllm_login first (opens a visible browser to sign in once).`);

    if (site.modelHint) await selectModel(page, site.modelHint);

    await inputEl.click();
    await page.type(site.input, prompt, { delay: 5 });
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 3000));
    let lastLen = 0, stableCount = 0;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = await page.evaluate((sel) => {
        const nodes = document.querySelectorAll(sel);
        return nodes.length ? nodes[nodes.length - 1].innerText : '';
      }, site.response).catch(() => '');
      if (text.length === lastLen && text.length > 0) { stableCount++; if (stableCount >= 3) return { provider, response: text }; }
      else { stableCount = 0; lastLen = text.length; }
      await new Promise(r => setTimeout(r, 1000));
    }
    const final = await page.evaluate((sel) => {
      const nodes = document.querySelectorAll(sel);
      return nodes.length ? nodes[nodes.length - 1].innerText : '(no response captured)';
    }, site.response).catch(() => '(no response captured)');
    return { provider, response: final };
  } finally {
    await browser.close();
  }
}

async function isLoggedIn(provider) {
  const site = siteOf(provider);
  const browser = await launch(provider, true);
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const hasInput = await page.$(site.input).catch(() => null);
  const url = page.url();
  await browser.close();
  return !!hasInput && !/login|signin|auth/i.test(url);
}

function status() {
  const out = {};
  for (const p of Object.keys(SITES)) {
    const dir = path.join(PROFILE_ROOT, p);
    out[p] = fs.existsSync(dir) && fs.readdirSync(dir).length > 0 ? 'session saved' : 'not logged in';
  }
  return out;
}

module.exports = { ask, openLoginWindow, isLoggedIn, status, SITES };
