const express = require('express');
const router = express.Router();
const { getAllSettings, updateSetting } = require('../db');
const { testAIConnection } = require('../ai-service');
const { reinitWatcher } = require('../watcher');

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const settings = getAllSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      updateSetting(key, value);
    }

    // If obsidianPath changed, reinitialize watcher
    if (updates.obsidianPath) {
      await reinitWatcher();
    }

    const settings = getAllSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/settings/test-ai
router.post('/test-ai', async (req, res) => {
  try {
    const result = await testAIConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
