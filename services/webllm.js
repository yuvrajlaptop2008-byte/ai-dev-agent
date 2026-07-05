/**
 * WEBLLM - Drive Claude.ai / ChatGPT / Gemini through a real logged-in browser
 * session (persistent profile), instead of paid APIs. First run needs a manual
 * login once; session cookies persist in ./data/browser-profile/<provider>.
 */
const path = require('path');
const fs = require('fs');

const PROFILE_ROOT = path.join(__dirname, '../data/browser-profile');
const SITES = {
  claude:  { url: 'https://claude.ai/new',        input: 'div[contenteditable="true"]', submit: 'button[aria-label*="Send"]', response: '.font-claude-message' },
  chatgpt: { url: 'https://chatgpt.com/',          input: '#prompt-textarea',            submit: 'button[data-testid="send-button"]', response: 'div[data-message-author-role="assistant"]' },
  gemini:  { url: 'https://gemini.google.com/app', input: 'div[contenteditable="true"]', submit: 'button[aria-label*="Send"]', response: 'message-content' },
};

let _puppeteer = null;
function getPuppeteer() {
  if (_puppeteer) return _puppeteer;
  try { _puppeteer = require('puppeteer'); return _puppeteer; }
  catch { return null; }
}

async function getBrowser(provider) {
  const puppeteer = getPuppeteer();
  if (!puppeteer) throw new Error('puppeteer not installed — run: npm install puppeteer');
  const userDataDir = path.join(PROFILE_ROOT, provider);
  fs.mkdirSync(userDataDir, { recursive: true });
  return puppeteer.launch({
    headless: false, // must be visible for first login; set true after cookies are saved
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  });
}

async function isLoggedIn(provider) {
  const site = SITES[provider];
  const browser = await getBrowser(provider);
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const hasInput = await page.$(site.input).catch(() => null);
  const url = page.url();
  await browser.close();
  const loggedOut = /login|signin|auth/i.test(url);
  return !!hasInput && !loggedOut;
}

// Opens a real visible window so the user can log in once. Session persists after.
async function openLoginWindow(provider) {
  const site = SITES[provider];
  if (!site) throw new Error(`Unknown provider: ${provider}. Use claude, chatgpt, or gemini.`);
  const browser = await getBrowser(provider);
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { message: `Browser window opened for ${provider}. Log in manually, then session is saved for future headless use.`, keepOpen: true, browser };
}

// Sends a prompt using the saved logged-in session (headless) and returns the reply text.
async function ask(provider, prompt, timeoutMs = 60000) {
  const site = SITES[provider];
  if (!site) throw new Error(`Unknown provider: ${provider}`);
  const puppeteer = getPuppeteer();
  if (!puppeteer) throw new Error('puppeteer not installed — run: npm install puppeteer');

  const userDataDir = path.join(PROFILE_ROOT, provider);
  fs.mkdirSync(userDataDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', userDataDir, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });

    const loggedIn = await page.$(site.input).catch(() => null);
    if (!loggedIn) {
      throw new Error(`Not logged in to ${provider}. Call webllm_login first (opens a visible browser to sign in once).`);
    }

    await page.click(site.input);
    await page.type(site.input, prompt, { delay: 5 });
    await page.keyboard.press('Enter');

    // Wait for a new response block to appear/stop growing
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

function status() {
  const out = {};
  for (const p of Object.keys(SITES)) {
    const dir = path.join(PROFILE_ROOT, p);
    out[p] = fs.existsSync(dir) && fs.readdirSync(dir).length > 0 ? 'session saved' : 'not logged in';
  }
  return out;
}

module.exports = { ask, openLoginWindow, isLoggedIn, status, SITES };
