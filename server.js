require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/chat', require('./routes/chat'));
app.use('/api/github', require('./routes/github'));
app.use('/api/models', require('./routes/models'));
app.use('/api/mcp', require('./routes/mcp'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/files', require('./routes/files'));
app.use('/api/memory', require('./routes/memory'));

// Serve frontend
if (fs.existsSync(path.join(__dirname, 'frontend/dist'))) {
  app.use(express.static('frontend/dist'));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend/dist/index.html')));
}

// Socket for streaming
io.on('connection', (socket) => {
  socket.on('stream-chat', async (data) => {
    const { streamChat } = require('./services/openrouter');
    try {
      await streamChat(data, (chunk) => socket.emit('chunk', chunk), () => socket.emit('done'));
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  socket.on('run-agent', async (data) => {
    const { runAgent } = require('./services/agent');
    await runAgent(data, socket);
  });
});

global.io = io;
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`AI Dev Agent running on port ${PORT}`));
