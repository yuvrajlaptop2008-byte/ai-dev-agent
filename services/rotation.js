/**
 * ROTATION - OpenRouter key rotation (up to 3 keys) + model pool rotation
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '../data/rotation.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { openrouterKeys: [], models: [], orIdx: 0, modelIdx: 0, orFail: {} }; }
}
function save(s) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); }

function setOpenrouterKeys(keys) { const s = load(); s.openrouterKeys = keys.filter(Boolean); s.orIdx = 0; save(s); }
function setModelPool(models) { const s = load(); s.models = models.filter(Boolean); s.modelIdx = 0; save(s); }

function getOpenrouterKey() {
  const s = load();
  if (!s.openrouterKeys.length) return process.env.OPENROUTER_API_KEY;
  return s.openrouterKeys[s.orIdx % s.openrouterKeys.length];
}
function nextModel() {
  const s = load();
  if (!s.models.length) return null;
  const m = s.models[s.modelIdx % s.models.length];
  s.modelIdx++; save(s);
  return m;
}
function rotateOpenrouter() {
  const s = load();
  if (!s.openrouterKeys.length) return null;
  s.orFail[s.orIdx] = (s.orFail[s.orIdx] || 0) + 1;
  s.orIdx = (s.orIdx + 1) % s.openrouterKeys.length;
  save(s);
  return s.openrouterKeys[s.orIdx];
}
function status() {
  const s = load();
  return { openrouterKeys: s.openrouterKeys.length, openrouterActive: s.orIdx, models: s.models, modelIdx: s.modelIdx };
}

module.exports = { setOpenrouterKeys, setModelPool, getOpenrouterKey, nextModel, rotateOpenrouter, status };
