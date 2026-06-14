const {
  getItems,
  getItemById,
  updateMasteryLevel,
  recordReview,
  createTrainingSession,
  completeTrainingSession,
  saveSessionResults,
  getSetting,
} = require('./db');
const { generateTask, generateTransferTask, evaluateAnswer } = require('./ai-service');

// In-memory session store (sessions only live while server is running)
const activeSessions = new Map();

/**
 * Map mastery level to training mode
 */
function getModeForLevel(level) {
  if (level <= 1) return 'A'; // Recognition
  if (level <= 3) return 'B'; // Recall
  if (level === 4) return 'C'; // Controlled Production
  if (level === 5) return 'D'; // Guided Production
  return 'E'; // Free Production (level 6+)
}

/**
 * Select items for today's training
 *
 * Strategy:
 * - 2 items: weakest + least recently reviewed
 * - 2 items: recently added + least reviewed
 * - 1 item: transfer (combine 2+ mastered expressions)
 * - N items: extra review (user-configured)
 */
function selectTrainingItems(allItems, baseCount, extraCount) {
  const items = [...allItems];

  if (items.length === 0) {
    return [];
  }

  const selected = [];
  const usedIds = new Set();

  // 1. Weak items: low mastery level, least recently reviewed
  const weakItems = items
    .filter((i) => i.mastery_level <= 3)
    .sort((a, b) => {
      // Primary: by mastery level (ascending)
      if (a.mastery_level !== b.mastery_level) return a.mastery_level - b.mastery_level;
      // Secondary: by last review time (oldest first)
      const aTime = a.last_review_time || '2000-01-01';
      const bTime = b.last_review_time || '2000-01-01';
      return aTime.localeCompare(bTime);
    });

  const weakCount = Math.min(2, weakItems.length);
  for (let i = 0; i < weakCount; i++) {
    if (!usedIds.has(weakItems[i].id)) {
      selected.push(weakItems[i]);
      usedIds.add(weakItems[i].id);
    }
  }

  // 2. Recent items: recently created, least reviewed
  const recentItems = items
    .filter((i) => !usedIds.has(i.id))
    .sort((a, b) => {
      // Primary: by review count (ascending)
      if (a.review_count !== b.review_count) return a.review_count - b.review_count;
      // Secondary: by created time (newest first)
      const aTime = a.created_time || '2000-01-01';
      const bTime = b.created_time || '2000-01-01';
      return bTime.localeCompare(aTime);
    });

  const recentCount = Math.min(2, recentItems.length);
  for (let i = 0; i < recentCount; i++) {
    if (!usedIds.has(recentItems[i].id)) {
      selected.push(recentItems[i]);
      usedIds.add(recentItems[i].id);
    }
  }

  // 3. Transfer: combine 2+ mastered (level 5+) items
  const masteredItems = items.filter(
    (i) => !usedIds.has(i.id) && i.mastery_level >= 5
  );

  if (masteredItems.length >= 2 && selected.length < baseCount) {
    // We don't add transfer items to selected directly
    // They are handled separately in generateTodayTraining
  }

  // 4. Fill remaining base slots + extra
  const remainingItems = items
    .filter((i) => !usedIds.has(i.id))
    .sort(() => Math.random() - 0.5);

  const totalTarget = baseCount + extraCount;
  // Reserve 1 slot for transfer if available
  const fillTarget = masteredItems.length >= 2
    ? totalTarget - 1
    : totalTarget;

  const fillCount = Math.min(
    Math.max(0, fillTarget - selected.length),
    remainingItems.length
  );

  for (let i = 0; i < fillCount; i++) {
    if (!usedIds.has(remainingItems[i].id)) {
      selected.push(remainingItems[i]);
      usedIds.add(remainingItems[i].id);
    }
  }

  return { selected, masteredCandidates: masteredItems };
}

/**
 * Adjust mastery level based on AI evaluation
 */
function adjustMasteryLevel(item, feedback) {
  const { accuracy } = feedback;
  const currentLevel = item.mastery_level;

  let newLevel = currentLevel;

  if (accuracy >= 8) {
    // Strong performance: level up
    newLevel = Math.min(6, currentLevel + 1);
  } else if (accuracy >= 5) {
    // Adequate: maintain
    newLevel = currentLevel;
  } else {
    // Poor: level down (but not below 0)
    newLevel = Math.max(0, currentLevel - 1);
  }

  return newLevel;
}

/**
 * Generate today's training session
 */
async function generateTodayTraining() {
  // Get all items
  const { items } = getItems({ limit: 10000 });
  if (items.length === 0) {
    throw new Error(
      'No items in corpus. Please scan your Obsidian folder first in Settings.'
    );
  }

  const baseCount = parseInt(getSetting('dailyQuestionCount')) || 5;
  const extraCount = parseInt(getSetting('extraReviewCount')) || 0;

  const { selected, masteredCandidates } = selectTrainingItems(
    items,
    baseCount,
    extraCount
  );

  // Ensure at least 1 pattern is included in daily training
  const hasPattern = selected.some(i => i.type === 'pattern');
  if (!hasPattern) {
    const patterns = items.filter(i => i.type === 'pattern' && !selected.find(s => s.id === i.id));
    if (patterns.length > 0) {
      // Replace the last "fill" item (index 4+) with a random pattern
      const fillStartIdx = 4; // after 2 weak + 2 recent
      if (selected.length > fillStartIdx) {
        const replaceIdx = selected.length - 1;
        const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
        selected[replaceIdx] = randomPattern;
      } else if (selected.length > 0) {
        // If less than 5 items, replace the last one
        const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
        selected[selected.length - 1] = randomPattern;
      }
    }
  }

  // Build task list
  const tasks = [];
  const sessionItems = [];

  // Generate individual tasks
  for (const item of selected) {
    const mode = getModeForLevel(item.mastery_level);
    sessionItems.push(item.id);

    let taskData;
    try {
      taskData = await generateTask(item, mode);
    } catch (err) {
      console.error(`Failed to generate task for "${item.content}":`, err.message);
      taskData = {
        prompt: `Use "${item.content}" in a sentence.`,
        hint: `Type: ${item.type}`,
        expectedAnswer: item.content,
        options: mode === 'A' ? [item.content, '', '', ''] : undefined,
      };
    }

    tasks.push({
      id: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: item.id,
      content: item.content,
      type: item.type,
      masteryLevel: item.mastery_level,
      mode,
      prompt: taskData.prompt,
      hint: taskData.hint || null,
      options: taskData.options || null,
      expectedAnswer: taskData.expectedAnswer || item.content,
      required: taskData.required || null,
    });
  }

  // Add transfer task if we have mastered candidates
  if (masteredCandidates.length >= 2) {
    const transferItems = masteredCandidates
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, masteredCandidates.length));

    const transferData = await generateTransferTask(transferItems);
    const combinedContent = transferItems.map((i) => i.content).join(' + ');

    tasks.push({
      id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: null, // transfer tasks don't map to a single item
      content: combinedContent,
      type: 'pattern',
      masteryLevel: 6,
      mode: 'F',
      prompt: transferData.prompt,
      hint: transferData.hint || null,
      expectedAnswer: transferData.expectedAnswer || '',
      required: transferItems.map((i) => i.content),
    });

    transferItems.forEach((ti) => sessionItems.push(ti.id));
  }

  // Create session in database
  const sessionId = createTrainingSession(sessionItems, []);
  const session = {
    sessionId,
    tasks,
    totalCount: tasks.length,
    estimatedMinutes: `${Math.round(tasks.length * 2)}-${Math.round(tasks.length * 3)}`,
  };

  // Store in memory
  activeSessions.set(sessionId, {
    items: sessionItems,
    results: [],
    createdAt: Date.now(),
  });

  return session;
}

/**
 * Evaluate a user's answer
 */
async function evaluateTrainingAnswer(sessionId, taskId, userAnswer, expectedAnswerFromFrontend, evalModeOverride) {
  // Find the active session
  const sessionData = activeSessions.get(sessionId);

  // Parse taskId to get itemId
  const parts = taskId.split('-');
  const itemId = parts[0] === 'transfer' ? null : parseInt(parts[0]);

  // Build task info for evaluation
  const taskInfo = {
    content: null,
    expectedAnswer: expectedAnswerFromFrontend || null,
    prompt: 'Evaluate this answer',
    hint: null,
  };

  // Try to get item from DB
  if (itemId) {
    const item = getItemById(itemId);
    if (item) {
      taskInfo.content = item.content;
      if (!taskInfo.expectedAnswer) {
        taskInfo.expectedAnswer = item.content;
      }
      taskInfo.prompt = `Use "${item.content}" correctly.`;
    }
  }

  // Determine evaluation mode
  let evalMode = evalModeOverride || 'A'; // use frontend override or default
  if (!evalModeOverride) {
    if (itemId) {
      const item = getItemById(itemId);
      if (item) {
        evalMode = getModeForLevel(item.mastery_level);
      }
    } else {
      evalMode = 'F'; // transfer task
    }
  }

  // Get AI evaluation
  const feedback = await evaluateAnswer(taskInfo, userAnswer, evalMode);

  // Include correct/selected answer info for multiple choice display
  feedback.correctAnswer = taskInfo.expectedAnswer || null;
  feedback.userAnswer = userAnswer;
  feedback.mode = evalMode;

  // Update item mastery if applicable
  if (itemId) {
    const item = getItemById(itemId);
    if (item) {
      const isCorrect = feedback.accuracy >= 6;
      recordReview(itemId, isCorrect);

      const newLevel = adjustMasteryLevel(item, feedback);
      updateMasteryLevel(itemId, newLevel);
      feedback.newMasteryLevel = newLevel;
      feedback.previousMasteryLevel = item.mastery_level;
    }
  }

  // Store result in session
  if (sessionData) {
    sessionData.results.push({
      taskId,
      itemId,
      answer: userAnswer,
      ...feedback,
    });
    // Persist results to DB
    try {
      saveSessionResults(sessionId, sessionData.results);
    } catch (e) {
      // non-critical, don't fail the evaluation
    }
  }

  return feedback;
}

// Clean up stale sessions every hour
setInterval(() => {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours
  for (const [id, data] of activeSessions) {
    if (now - data.createdAt > maxAge) {
      // Mark as completed in DB if not already
      try {
        completeTrainingSession(id);
      } catch (e) {
        // ignore
      }
      activeSessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  generateTodayTraining: generateTodayTraining,
  evaluateAnswer: evaluateTrainingAnswer,
};
