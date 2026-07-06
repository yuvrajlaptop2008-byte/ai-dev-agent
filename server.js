require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' }, maxHttpBufferSize: 1e8 });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/chat', require('./routes/chat'));
app.use('/api/github', require('./routes/github'));
app.use('/api/models', require('./routes/models'));
app.use('/api/mcp', require('./routes/mcp'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/files', require('./routes/files'));
app.use('/api/contributor', require('./routes/contributor'));
app.use('/api/memory', require('./routes/memory'));
app.use('/api/brain', require('./routes/brain'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/rotation', require('./routes/rotation'));
app.use('/api/builder', require('./routes/builder'));
app.use('/api/webllm', require('./routes/webllm'));

// Serve frontend
const distPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Streaming chat
  socket.on('stream-chat', async (data) => {
    const { streamChat } = require('./services/openrouter');
    const { db } = require('./db');
    const { v4: uuidv4 } = require('uuid');
    let fullText = '';
    const convId = data.convId;
    try {
      if (convId && data.messages?.length) {
        const lastUser = data.messages[data.messages.length - 1];
        if (lastUser.role === 'user') {
          try { db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,unixepoch())').run(uuidv4(), convId, 'user', lastUser.content, null); } catch {}
        }
      }
      await streamChat(
        data,
        (chunk) => { if (chunk.type === 'text') { fullText += chunk.content; socket.emit('chunk', chunk.content); } },
        (meta) => {
          if (convId && fullText) {
            try {
              db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,unixepoch())').run(uuidv4(), convId, 'assistant', fullText, JSON.stringify({ model: data.model }));
              db.prepare('UPDATE conversations SET updated_at=unixepoch() WHERE id=?').run(convId);
            } catch {}
          }
          socket.emit('done', { ...meta, fullText });
        },
        (err) => socket.emit('error', err.message)
      );
    } catch (e) { socket.emit('error', e.message); }
  });

  // Autonomous agent
  socket.on('run-agent', (data) => {
    const { runAgent } = require('./services/agent');
    runAgent(data, socket).catch(e => socket.emit('agent-error', { error: e.message }));
  });

  socket.on('continue-agent', ({ runId, instruction }) => {
    const { continueAgent } = require('./services/agent');
    continueAgent(runId, socket, instruction).catch(e => socket.emit('agent-error', { runId, error: e.message }));
  });

  socket.on('stop-agent', ({ runId }) => {
    const { stopAgent } = require('./services/agent');
    const ok = stopAgent(runId);
    socket.emit('agent-stop-ack', { runId, ok });
  });

  // Brain tools (direct access)
  socket.on('brain-think', async ({ problem, context, model }) => {
    const brain = require('./services/brain');
    try {
      const result = await brain.deepThink(problem, model || 'meta-llama/llama-3.3-70b-instruct:free', context);
      socket.emit('brain-result', { type: 'think', result });
    } catch (e) { socket.emit('brain-error', e.message); }
  });

  socket.on('brain-research', async ({ topic, depth }) => {
    const browser = require('./services/browser');
    const brain = require('./services/brain');
    try {
      const report = await browser.deepResearch(topic, depth || 2);
      const sources = [...report.searchResults.map(r => `${r.title}: ${r.snippet}`), ...report.pageContents.map(p => p.content?.slice(0, 1500))];
      const synthesis = await brain.synthesizeResearch(topic, sources, 'meta-llama/llama-3.3-70b-instruct:free');
      socket.emit('brain-result', { type: 'research', result: synthesis, raw: report });
    } catch (e) { socket.emit('brain-error', e.message); }
  });

  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

global.io = io;
// Auto-refresh OpenRouter model list every 6h
require('./services/openrouter').getModels(true).catch(()=>{});
setInterval(() => require('./services/openrouter').getModels(true).catch(()=>{}), 6*60*60*1000);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n⚡ ARIA - AI Dev Agent`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🤖 80+ tools | Multi-model | VSCode | GitHub | Browser Research\n`);
});
// Added by patch
