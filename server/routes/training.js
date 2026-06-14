const express = require('express');
const router = express.Router();
const { generateTodayTraining, evaluateAnswer } = require('../training-engine');
const { getRecentSessions } = require('../db');

// GET /api/training/today
router.get('/today', async (req, res) => {
  try {
    const training = await generateTodayTraining();
    res.json(training);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/training/submit
router.post('/submit', async (req, res) => {
  try {
    const { sessionId, taskId, answer, expectedAnswer, mode } = req.body;
    if (!taskId || answer === undefined) {
      return res.status(400).json({ message: 'taskId and answer are required' });
    }
    const feedback = await evaluateAnswer(sessionId, taskId, answer, expectedAnswer, mode);
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/training/history
router.get('/history', (req, res) => {
  try {
    const sessions = getRecentSessions(30);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
