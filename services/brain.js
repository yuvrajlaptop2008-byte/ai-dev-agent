/**
 * BRAIN - Central Intelligence Service
 * Handles: thinking, planning, decision making, research, memory
 */
const { chat } = require('./openrouter');
const fs = require('fs').promises;
const path = require('path');

const BRAIN_DIR = '/tmp/agent-brain';
const ensureDir = async () => fs.mkdir(BRAIN_DIR, { recursive: true });

// ─── LIGHTWEIGHT RESPONSE CACHE (saves tokens on repeat queries, 15min TTL) ──
const _cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;
function cacheKey(fn, args) { return `${fn}:${JSON.stringify(args)}`; }
function cacheGet(key) { const e = _cache.get(key); if (e && Date.now() - e.t < CACHE_TTL) return e.v; _cache.delete(key); return null; }
function cacheSet(key, v) { _cache.set(key, { v, t: Date.now() }); if (_cache.size > 200) _cache.delete(_cache.keys().next().value); }

// ─── THINKING ENGINE ──────────────────────────────────────
async function deepThink(problem, model, context = '') {
  const ck = cacheKey('think', { problem, model, context });
  const cached = cacheGet(ck); if (cached) return cached;
  const prompt = `You are a deep reasoning AI. Think step by step about this problem.

Problem: ${problem}
${context ? `Context: ${context}` : ''}

Think through:
1. What exactly is being asked?
2. What do I know / need to know?
3. What are possible approaches?
4. Which approach is best and why?
5. What are the risks/edge cases?
6. Concrete action plan with steps

Be thorough, analytical, and precise.`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 8000, temperature: 0.2 });
  const out = r.choices[0].message.content;
  cacheSet(ck, out);
  return out;
}

// ─── PLANNING ENGINE ──────────────────────────────────────
async function createPlan(goal, model, context = '') {
  const prompt = `Create a detailed execution plan for this goal.

Goal: ${goal}
${context ? `Available context: ${context}` : ''}

Return a JSON plan with this exact structure:
{
  "goal": "the goal",
  "complexity": "low|medium|high",
  "estimated_steps": number,
  "phases": [
    {
      "name": "Phase name",
      "objective": "what this phase achieves",
      "steps": [
        {
          "step": 1,
          "action": "specific action",
          "tool": "which tool to use",
          "reasoning": "why this step"
        }
      ]
    }
  ],
  "success_criteria": ["criterion1", "criterion2"],
  "risks": ["risk1", "risk2"],
  "fallback": "what to do if main plan fails"
}

Return ONLY valid JSON, no markdown.`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 4000, temperature: 0.1 });
  let content = r.choices[0].message.content.trim();
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(content);
  } catch {
    return { goal, phases: [{ name: 'Execute', steps: [{ step: 1, action: content, tool: 'bash' }] }], success_criteria: [], risks: [] };
  }
}

// ─── DECISION ENGINE ──────────────────────────────────────
async function decide(options, criteria, model) {
  const prompt = `You are a decision-making AI. Analyze these options and choose the best one.

Options:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Decision criteria: ${criteria}

Return JSON:
{
  "chosen": "the best option",
  "chosen_index": 0,
  "reasoning": "why this is best",
  "confidence": 0.0-1.0,
  "alternatives": [{"option": "...", "reason_not_chosen": "..."}]
}

Return ONLY valid JSON.`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 2000, temperature: 0.1 });
  let content = r.choices[0].message.content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(content); }
  catch { return { chosen: options[0], reasoning: content, confidence: 0.5 }; }
}

// ─── RESEARCH ENGINE ──────────────────────────────────────
async function synthesizeResearch(topic, sources, model) {
  const prompt = `Synthesize this research into a comprehensive summary.

Topic: ${topic}

Sources found:
${sources.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

Create:
1. Key findings summary
2. Important facts/data points
3. Best practices / recommendations
4. Code examples if applicable
5. Action items

Be specific and actionable.`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 6000, temperature: 0.2 });
  return r.choices[0].message.content;
}

// ─── MEMORY SYSTEM ────────────────────────────────────────
function condense(value) {
  // Keep memory lean: cap strings, drop huge objects, summarize arrays
  if (typeof value === 'string') return value.length > 500 ? value.slice(0, 500) + '…' : value;
  if (Array.isArray(value)) return value.slice(0, 10).map(condense);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).slice(0, 15)) out[k] = condense(value[k]);
    return out;
  }
  return value;
}

async function saveMemory(key, value, category = 'general') {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'memory.json');
  let mem = {};
  try { mem = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  if (!mem[category]) mem[category] = {};
  mem[category][key] = { value: condense(value), ts: Date.now() };
  // Cap category size to last 50 entries (drop oldest)
  const entries = Object.entries(mem[category]).sort((a,b) => b[1].ts - a[1].ts).slice(0, 50);
  mem[category] = Object.fromEntries(entries);
  await fs.writeFile(file, JSON.stringify(mem));
  return mem[category][key];
}

async function getMemory(key, category = 'general') {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'memory.json');
  try {
    const mem = JSON.parse(await fs.readFile(file, 'utf8'));
    if (key === '*') return mem;
    return category === '*' ? Object.values(mem).map(c => c[key]).filter(Boolean) : mem[category]?.[key];
  } catch { return null; }
}

async function searchMemory(query) {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'memory.json');
  try {
    const mem = JSON.parse(await fs.readFile(file, 'utf8'));
    const results = [];
    for (const [cat, items] of Object.entries(mem)) {
      for (const [k, v] of Object.entries(items)) {
        const text = `${k} ${JSON.stringify(v.value)}`.toLowerCase();
        if (text.includes(query.toLowerCase())) results.push({ category: cat, key: k, ...v });
      }
    }
    return results;
  } catch { return []; }
}

// ─── TASK QUEUE ───────────────────────────────────────────
async function saveTask(task) {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'tasks.json');
  let tasks = [];
  try { tasks = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  const t = { id: Date.now().toString(), ...task, created: new Date().toISOString(), status: 'pending' };
  tasks.unshift(t);
  await fs.writeFile(file, JSON.stringify(tasks.slice(0, 100), null, 2));
  return t;
}

async function getTasks() {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'tasks.json');
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; }
}

// ─── CODE ANALYSIS ────────────────────────────────────────
async function analyzeCode(code, language, task, model) {
  const prompt = `You are an expert ${language || 'software'} engineer. ${task || 'Analyze this code comprehensively.'}

\`\`\`${language || ''}
${code.slice(0, 8000)}
\`\`\`

Provide:
1. **Summary**: What this code does
2. **Issues Found**: Bugs, errors, logic problems
3. **Security**: Security vulnerabilities
4. **Performance**: Bottlenecks, inefficiencies
5. **Code Quality**: Style, maintainability, patterns
6. **Suggested Fix**: Improved version if needed

Be specific with line numbers and concrete fixes.`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 8000, temperature: 0.1 });
  return r.choices[0].message.content;
}

// ─── SMART ROUTING ────────────────────────────────────────
function selectBestModel(task, availableModels) {
  const t = task.toLowerCase();
  if (t.includes('code') || t.includes('bug') || t.includes('fix') || t.includes('implement')) return 'deepseek/deepseek-coder-v2';
  if (t.includes('reason') || t.includes('analyze') || t.includes('complex') || t.includes('think')) return 'anthropic/claude-3-opus';
  if (t.includes('search') || t.includes('research') || t.includes('find')) return 'anthropic/claude-3.5-sonnet';
  if (t.includes('quick') || t.includes('simple') || t.includes('list')) return 'anthropic/claude-3-haiku';
  return 'anthropic/claude-3.5-sonnet'; // default
}

module.exports = { deepThink, createPlan, decide, synthesizeResearch, saveMemory, getMemory, searchMemory, saveTask, getTasks, analyzeCode, selectBestModel };
