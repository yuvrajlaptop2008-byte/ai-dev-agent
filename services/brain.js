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
function selectBestModel(task) {
  const t = (task || '').toLowerCase();
  if (t.includes('code') || t.includes('bug') || t.includes('fix') || t.includes('implement')) return 'qwen/qwen-2.5-coder-32b-instruct:free';
  if (t.includes('reason') || t.includes('analyze') || t.includes('complex') || t.includes('think')) return 'qwen/qwen3-235b-a22b:free';
  if (t.includes('search') || t.includes('research') || t.includes('find')) return 'meta-llama/llama-3.3-70b-instruct:free';
  if (t.includes('quick') || t.includes('simple') || t.includes('list')) return 'google/gemma-3-27b-it:free';
  return 'meta-llama/llama-3.3-70b-instruct:free';
}

// ─── SKILL LEARNING — self-improving memory ────────────────
// After a task succeeds, extract a reusable "skill" (pattern + approach + pitfalls)
// and store it. Before similar future tasks, relevant skills are recalled and fed
// back in as guidance — this is how the agent gets better over time.

function taskFingerprint(task) {
  return (task || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 12);
}

async function learnSkill(task, outcomeSummary, model) {
  const prompt = `A task just completed successfully. Extract a REUSABLE skill from it — something that will help with similar future tasks.

Task: ${task}
What happened: ${outcomeSummary?.slice(0, 2000)}

Return JSON only:
{
  "skill_name": "short-kebab-case-name",
  "applies_to": "what kind of future tasks this helps with",
  "approach": "the key steps/strategy that worked, in 2-4 sentences",
  "pitfalls": "anything that went wrong or should be avoided next time, or empty string",
  "tools_used": ["tool1","tool2"]
}`;
  try {
    const r = await chat([{ role: 'user', content: prompt }], model || 'meta-llama/llama-3.3-70b-instruct:free', [], null, { max_tokens: 800, temperature: 0.2 });
    let txt = r.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const skill = JSON.parse(txt);
    skill.keywords = taskFingerprint(task);
    skill.uses = 1;
    await saveMemory(skill.skill_name || `skill_${Date.now()}`, skill, 'skills');
    return skill;
  } catch { return null; }
}

async function getRelevantSkills(task, limit = 3) {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'memory.json');
  let mem = {};
  try { mem = JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; }
  const skills = mem.skills || {};
  const taskWords = new Set(taskFingerprint(task));
  const scored = Object.entries(skills).map(([name, entry]) => {
    const s = entry.value || {};
    const kw = s.keywords || [];
    const overlap = kw.filter(w => taskWords.has(w)).length;
    return { name, score: overlap, skill: s };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  // bump usage count on recalled skills (reinforcement — used skills become "stronger"/more trusted over time)
  for (const t of top) {
    try {
      t.skill.uses = (t.skill.uses || 1) + 1;
      await saveMemory(t.name, t.skill, 'skills');
    } catch {}
  }
  return top.map(t => t.skill);
}

async function skillsSummary() {
  await ensureDir();
  const file = path.join(BRAIN_DIR, 'memory.json');
  try {
    const mem = JSON.parse(await fs.readFile(file, 'utf8'));
    const skills = Object.values(mem.skills || {}).map(e => e.value);
    return skills.sort((a, b) => (b.uses || 0) - (a.uses || 0));
  } catch { return []; }
}

module.exports = { deepThink, createPlan, decide, synthesizeResearch, saveMemory, getMemory, searchMemory, saveTask, getTasks, analyzeCode, selectBestModel, learnSkill, getRelevantSkills, skillsSummary };
