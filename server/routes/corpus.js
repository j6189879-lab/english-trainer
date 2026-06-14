const express = require('express');
const router = express.Router();
const { getItems, getCorpusStats } = require('../db');
const { scanAllFiles } = require('../watcher');

// GET /api/corpus/items
router.get('/items', (req, res) => {
  try {
    const { type, masteryLevel, page, limit } = req.query;
    const result = getItems({ type, masteryLevel, page: Number(page) || 1, limit: Number(limit) || 50 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/corpus/scan
router.post('/scan', async (req, res) => {
  try {
    const result = await scanAllFiles();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/corpus/stats
router.get('/stats', (req, res) => {
  try {
    const stats = getCorpusStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
