const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'agent.db');

// Use better-sqlite3 if available, else fallback to file-based JSON store
let db, get, set;

try {
  const Database = require('better-sqlite3');
  const d = new Database(dbFile);
  d.pragma('journal_mode = WAL');
  initSchema(d);
  db = d;
  get = (key) => d.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
  set = (key, value) => d.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(key, value);
} catch (e) {
  // Fallback: JSON-based store with same API surface
  const store = loadStore();
  
  db = {
    prepare: (sql) => ({
      all: (...args) => queryStore(store, sql, args),
      get: (...args) => queryStore(store, sql, args)?.[0] || undefined,
      run: (...args) => runStore(store, sql, args),
    }),
    exec: (sql) => initJsonStore(store)
  };
  get = (key) => store.settings[key];
  set = (key, value) => { store.settings[key] = value; saveStore(store); };
  initJsonStore(store);
}

function loadStore() {
  const f = path.join(dataDir, 'store.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return { settings: {}, conversations: [], messages: [], agent_runs: [], mcp_servers: [] };
}

function saveStore(store) {
  fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify(store, null, 2));
}

function initJsonStore(store) {
  const STALE_DEFAULTS = ['You are an expert AI coding agent.', 'You are an expert AI coding agent. You can solve GitHub issues, write code, research solutions, plan projects, and execute tasks autonomously. Always think step by step and be thorough.'];
  if (!store.settings.system_prompt || STALE_DEFAULTS.includes(store.settings.system_prompt)) store.settings.system_prompt = require('../services/persona').ARIA_PERSONA;
  if (!store.settings.default_model) store.settings.default_model = 'meta-llama/llama-3.3-70b-instruct:free';
  saveStore(store);
}

function queryStore(store, sql, args) {
  const s = sql.toLowerCase();
  if (s.includes('from settings') && s.includes('where key')) {
    return [{ value: store.settings[args[0]] }];
  }
  if (s.includes('from settings')) return Object.entries(store.settings).map(([key, value]) => ({ key, value }));
  if (s.includes('from conversations')) return store.conversations.sort((a, b) => b.updated_at - a.updated_at).slice(0, 50);
  if (s.includes('from messages') && s.includes('where conversation_id')) return store.messages.filter(m => m.conversation_id === args[0]).sort((a, b) => a.created_at - b.created_at);
  if (s.includes('from agent_runs')) return store.agent_runs.sort((a, b) => b.created_at - a.created_at).slice(0, 20);
  if (s.includes('from mcp_servers')) return store.mcp_servers;
  return [];
}

function runStore(store, sql, args) {
  const s = sql.toLowerCase();
  const ts = Date.now();
  if (s.includes('insert') && s.includes('conversations')) store.conversations.push({ id: args[0], title: args[1], model: args[2], created_at: ts, updated_at: ts });
  if (s.includes('insert') && s.includes('messages')) store.messages.push({ id: args[0], conversation_id: args[1], role: args[2], content: args[3], metadata: args[4], created_at: ts });
  if (s.includes('insert') && s.includes('agent_runs')) store.agent_runs.push({ id: args[0], task: args[1], status: args[2], steps: args[3], result: args[4], created_at: ts });
  if (s.includes('insert') && s.includes('mcp_servers')) store.mcp_servers.push({ id: args[0], name: args[1], url: args[2], type: args[3], enabled: 1, config: args[5] || '{}' });
  if (s.includes('insert') && s.includes('settings')) store.settings[args[0]] = args[1];
  if (s.includes('update conversations') && s.includes('updated_at')) { const c = store.conversations.find(c => c.id === args[1]); if (c) { c.updated_at = ts; c.model = args[0]; } }
  if (s.includes('update conversations') && s.includes('title')) { const c = store.conversations.find(c => c.id === args[1]); if (c) c.title = args[0]; }
  if (s.includes('update agent_runs')) { const r = store.agent_runs.find(r => r.id === args[s.includes('steps') ? 1 : 2]); if (r) { if (s.includes('steps')) r.steps = args[0]; else { r.status = args[0]; r.result = args[1]; } } }
  if (s.includes('update mcp_servers')) { const srv = store.mcp_servers.find(s2 => s2.id === args[4]); if (srv) { srv.name = args[0]; srv.url = args[1]; srv.enabled = args[2]; srv.config = args[3]; } }
  if (s.includes('delete from messages')) store.messages = store.messages.filter(m => m.conversation_id !== args[0]);
  if (s.includes('delete from conversations')) store.conversations = store.conversations.filter(c => c.id !== args[0]);
  if (s.includes('delete from agent_runs')) store.agent_runs = store.agent_runs.filter(r => r.id !== args[0]);
  if (s.includes('delete from mcp_servers')) store.mcp_servers = store.mcp_servers.filter(s2 => s2.id !== args[0]);
  if (s.includes('insert or replace into settings')) store.settings[args[0]] = args[1];
  saveStore(store);
  return { lastInsertRowid: args[0] };
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT, model TEXT, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT, role TEXT, content TEXT, metadata TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY, task TEXT, status TEXT DEFAULT 'running', steps TEXT DEFAULT '[]', result TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS mcp_servers (id TEXT PRIMARY KEY, name TEXT, url TEXT, type TEXT, enabled INTEGER DEFAULT 1, config TEXT DEFAULT '{}');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_model', 'meta-llama/llama-3.3-70b-instruct:free');
  `);
  d.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('system_prompt', require('../services/persona').ARIA_PERSONA);
}

module.exports = { db, get, set };
