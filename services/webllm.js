/**
 * WEBLLM - Drive Claude.ai / ChatGPT / Gemini / Google AI Studio through a real
 * logged-in browser session (persistent profile), instead of paid APIs. First
 * run needs a manual login once; session cookies persist in
 * ./data/browser-profile/<provider>.
 */
const path = require('path');
const fs = require('fs');

const PROFILE_ROOT = path.join(__dirname, '../data/browser-profile');
const MAX_RESPONSE_CHARS = 6000; // cap to save tokens downstream

const SITES = {
  claude:   { url: 'https://claude.ai/new',                input: 'div[contenteditable="true"]', submitMethod: 'enter',     response: '.font-claude-message' },
  chatgpt:  { url: 'https://chatgpt.com/',                  input: '#prompt-textarea',            submitMethod: 'enter',     response: 'div[data-message-author-role="assistant"]' },
  gemini:   { url: 'https://gemini.google.com/app',         input: 'div[contenteditable="true"]', submitMethod: 'enter',     response: 'message-content' },
  aistudio: { url: 'https://aistudio.google.com/prompts/new_chat', input: 'textarea', submitMethod: 'ctrlEnter', response: 'ms-chat-turn:last-of-type, ms-cmark-node', modelPicker: '[data-test-id="model-selector-button"], ms-model-selector button' },
};

// friendly aliases -> substring shown in AI Studio's model picker
const AISTUDIO_MODEL_ALIASES = {
  gemma: 'Gemma', 'gemma-2': 'Gemma 2', 'gemma-27b': 'Gemma 2 27B', 'gemma-9b': 'Gemma 2 9B', 'gemma-2b': 'Gemma 2 2B',
  'gemini-flash': 'Gemini 1.5 Flash', 'gemini-pro': 'Gemini 1.5 Pro',
};

let _puppeteer = null;
function getPuppeteer() {
  if (_puppeteer) return _puppeteer;
  try { _puppeteer = require('puppeteer'); return _puppeteer; } catch { return null; }
}

function profileDir(provider) {
  const dir = path.join(PROFILE_ROOT, provider);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launch(provider, headless) {
  const puppeteer = getPuppeteer();
  if (!puppeteer) throw new Error('puppeteer not installed — run: npm install puppeteer');
  return puppeteer.launch({ headless: headless ? 'new' : false, userDataDir: profileDir(provider), args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'] });
}

async function isLoggedIn(provider) {
  const site = SITES[provider];
  const browser = await launch(provider, false);
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const hasInput = await page.$(site.input).catch(() => null);
  const url = page.url();
  await browser.close();
  const loggedOut = /accounts\.google\.com|login|signin|auth\./i.test(url);
  return !!hasInput && !loggedOut;
}

// Opens a real visible window so the user can log in once. Session persists after.
async function openLoginWindow(provider) {
  const site = SITES[provider];
  if (!site) throw new Error(`Unknown provider: ${provider}. Use claude, chatgpt, gemini, or aistudio.`);
  const browser = await launch(provider, false);
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { message: `Browser window opened for ${provider}. Log in manually, then session is saved for future headless use.`, keepOpen: true, browser };
}

// Best-effort model pick in AI Studio's dropdown; silently no-ops if UI changed.
async function selectAistudioModel(page, label) {
  if (!label) return;
  const resolved = AISTUDIO_MODEL_ALIASES[label.toLowerCase()] || label;
  try {
    const btn = await page.$(SITES.aistudio.modelPicker);
    if (!btn) return;
    await btn.click();
    await new Promise(r => setTimeout(r, 600));
    const [el] = await page.$x(`//*[contains(normalize-space(text()), "${resolved}")]`);
    if (el) { await el.click(); await new Promise(r => setTimeout(r, 400)); }
    else await page.keyboard.press('Escape');
  } catch {}
}

// Sends a prompt using the saved logged-in session (headless) and returns the reply text.
// opts.model: for aistudio only, e.g. "gemma-27b", "gemma-9b", "gemini-flash"
async function ask(provider, prompt, timeoutMs = 60000, opts = {}) {
  const site = SITES[provider];
  if (!site) throw new Error(`Unknown provider: ${provider}`);
  const browser = await launch(provider, true);
  try {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });

    const loggedIn = await page.$(site.input).catch(() => null);
    if (!loggedIn) throw new Error(`Not logged in to ${provider}. Call webllm_login first (opens a visible browser to sign in once).`);

    if (provider === 'aistudio' && opts.model) await selectAistudioModel(page, opts.model);

    await page.click(site.input);
    await page.type(site.input, prompt, { delay: 4 });

    if (site.submitMethod === 'ctrlEnter') {
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
    } else {
      await page.keyboard.press('Enter');
    }

    await new Promise(r => setTimeout(r, 3000));
    let lastLen = 0, stableCount = 0;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = await page.evaluate((sel) => {
        const nodes = document.querySelectorAll(sel);
        return nodes.length ? nodes[nodes.length - 1].innerText : '';
      }, site.response).catch(() => '');
      if (text.length === lastLen && text.length > 0) { stableCount++; if (stableCount >= 3) return { provider, model: opts.model, response: text.slice(0, MAX_RESPONSE_CHARS) }; }
      else { stableCount = 0; lastLen = text.length; }
      await new Promise(r => setTimeout(r, 1000));
    }
    const final = await page.evaluate((sel) => {
      const nodes = document.querySelectorAll(sel);
      return nodes.length ? nodes[nodes.length - 1].innerText : '(no response captured)';
    }, site.response).catch(() => '(no response captured)');
    return { provider, model: opts.model, response: final.slice(0, MAX_RESPONSE_CHARS) };
  } finally {
    await browser.close();
  }
}

function status() {
  const out = {};
  for (const p of Object.keys(SITES)) {
    const dir = path.join(PROFILE_ROOT, p);
    out[p] = fs.existsSync(dir) && fs.readdirSync(dir).length > 0 ? 'session saved' : 'not logged in';
  }
  return out;
}

module.exports = { ask, openLoginWindow, isLoggedIn, status, SITES, AISTUDIO_MODEL_ALIASES };
