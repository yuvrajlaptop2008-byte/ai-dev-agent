const router = require('express').Router();
const { chat } = require('../services/openrouter');
const { db, get } = require('../db');
const { v4: uuid } = require('uuid');

// Get all conversations
router.get('/conversations', (req, res) => {
  const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50').all();
  res.json(rows);
});

// Create conversation
router.post('/conversations', (req, res) => {
  const id = uuid();
  const { title, model } = req.body;
  db.prepare('INSERT INTO conversations VALUES (?,?,?,unixepoch(),unixepoch())').run(id, title || 'New Chat', model || get('default_model'));
  res.json({ id, title, model });
});

// Get messages
router.get('/conversations/:id/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at').all(req.params.id);
  res.json(rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} })));
});

// Send message
router.post('/conversations/:id/messages', async (req, res) => {
  const { message, model } = req.body;
  const convId = req.params.id;

  // Get history
  const history = db.prepare('SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at').all(convId);
  const messages = [...history, { role: 'user', content: message }];

  // Save user message
  db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,unixepoch())').run(uuid(), convId, 'user', message, null);

  try {
    const sysPrompt = get('system_prompt');
    const response = await chat(messages, model, [], sysPrompt);
    const content = response.choices[0].message.content;
    const usage = response.usage;

    // Save assistant message
    db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,unixepoch())').run(uuid(), convId, 'assistant', content, JSON.stringify({ usage, model }));
    db.prepare('UPDATE conversations SET updated_at=unixepoch(), model=? WHERE id=?').run(model, convId);

    res.json({ content, usage, model });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete conversation
router.delete('/conversations/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE conversation_id=?').run(req.params.id);
  db.prepare('DELETE FROM conversations WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
