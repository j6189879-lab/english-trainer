const express = require('express');
const router = express.Router();
const { getCorpusStats, getTrainingDaysInPeriod, getTodayStats, getStreak } = require('../db');

// GET /api/progress/overview
router.get('/overview', (req, res) => {
  try {
    const stats = getCorpusStats();
    const trainingDays = getTrainingDaysInPeriod(7);
    const today = getTodayStats();
    const streak = getStreak();

    res.json({
      masteredCount: stats.mastered,
      newThisWeek: stats.newThisWeek,
      trainingDaysLast7: trainingDays,
      totalItems: stats.total,
      todayCompleted: today.todayCompleted,
      todayAccuracy: today.todayAccuracy,
      todaySessionsCount: today.todaySessionsCount,
      streak,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/progress/stats
router.get('/stats', (req, res) => {
  try {
    const stats = getCorpusStats();
    const trainingDays = getTrainingDaysInPeriod(30);
    const today = getTodayStats();
    const streak = getStreak();

    res.json({
      ...stats,
      trainingDaysLast30: trainingDays,
      todayCompleted: today.todayCompleted,
      todayAccuracy: today.todayAccuracy,
      streak,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
