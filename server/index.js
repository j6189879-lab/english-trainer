const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const { initDB } = require('./db');
const { initWatcher } = require('./watcher');

const app = express();
const PORT = 3456;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/corpus', require('./routes/corpus'));
app.use('/api/training', require('./routes/training'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/settings', require('./routes/settings'));

// Serve static frontend files
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
async function start() {
  await initDB();

  const server = app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`🚀 English Trainer ready at ${url}`);

    // Auto-open browser
    const platform = process.platform;
    const cmd = platform === 'win32'
      ? `start ${url}`
      : platform === 'darwin'
      ? `open ${url}`
      : `xdg-open ${url}`;
    exec(cmd);

    // Initialize file watcher
    initWatcher().catch(err => {
      console.warn('⚠️ File watcher not started:', err.message);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is in use. Close other programs or run: npx kill-port ${PORT}`);
      process.exit(1);
    }
    throw err;
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
