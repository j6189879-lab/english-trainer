const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'trainer.db');

let SQL = null;
let db = null;

// ── Initialization ──────────────────────────────────────────

async function initDB() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load sql.js
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('word','expression','pattern')),
      source_file TEXT NOT NULL,
      source_context TEXT,
      created_time TEXT DEFAULT (datetime('now', 'localtime')),
      mastery_level INTEGER DEFAULT 0 CHECK(mastery_level BETWEEN 0 AND 6),
      review_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      last_review_time TEXT,
      last_used_time TEXT,
      updated_time TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_items_mastery ON items(mastery_level)');
  db.run('CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_file)');
  db.run('CREATE INDEX IF NOT EXISTS idx_items_last_review ON items(last_review_time)');

  db.run(`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT DEFAULT (datetime('now', 'localtime')),
      items_trained TEXT,
      results TEXT,
      completed INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Insert default settings
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['obsidianPath', '']);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['dailyQuestionCount', '5']);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['extraReviewCount', '0']);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['deepseekApiKey', '']);

  saveDB();
  console.log('✅ Database initialized at', DB_PATH);
  return db;
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ── Helpers ─────────────────────────────────────────────────

/** Run a query and return all rows as objects */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Run a query and return the first row as object */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run a write statement */
function execute(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

/** Run a write statement with params, return lastID */
function executeInsert(sql, params = []) {
  db.run(sql, params);
  const result = queryOne('SELECT last_insert_rowid() as id');
  saveDB();
  return result ? result.id : null;
}

// ── Items CRUD ──────────────────────────────────────────────

function upsertItem({ content, type, source_file, source_context }) {
  const existing = queryOne(
    'SELECT id FROM items WHERE content = ? AND source_file = ?',
    [content, source_file]
  );

  if (existing) {
    execute(
      "UPDATE items SET type = ?, source_context = ?, updated_time = datetime('now', 'localtime') WHERE id = ?",
      [type, source_context || null, existing.id]
    );
    return existing.id;
  }

  return executeInsert(
    'INSERT INTO items (content, type, source_file, source_context) VALUES (?, ?, ?, ?)',
    [content, type, source_file, source_context || null]
  );
}

function getItems({ type, masteryLevel, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (masteryLevel !== undefined && masteryLevel !== null && masteryLevel !== '') {
    conditions.push('mastery_level = ?');
    params.push(Number(masteryLevel));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const items = queryAll(
    `SELECT * FROM items ${where} ORDER BY updated_time DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRow = queryOne(
    `SELECT COUNT(*) as count FROM items ${where}`,
    params
  );

  return { items, total: totalRow ? totalRow.count : 0, page: Number(page), limit: Number(limit) };
}

function getItemById(id) {
  return queryOne('SELECT * FROM items WHERE id = ?', [id]);
}

function updateMasteryLevel(id, level) {
  execute(
    "UPDATE items SET mastery_level = ?, updated_time = datetime('now', 'localtime') WHERE id = ?",
    [level, id]
  );
}

function recordReview(id, isCorrect) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  execute(
    `UPDATE items SET
      review_count = review_count + 1,
      correct_count = correct_count + ?,
      last_review_time = ?,
      last_used_time = ?,
      updated_time = datetime('now', 'localtime')
    WHERE id = ?`,
    [isCorrect ? 1 : 0, now, now, id]
  );
}

function deleteItemBySourceFile(source_file) {
  execute('DELETE FROM items WHERE source_file = ?', [source_file]);
}

function getAllSourceFiles() {
  return queryAll('SELECT DISTINCT source_file FROM items');
}

// ── Training Sessions ───────────────────────────────────────

function createTrainingSession(items, results) {
  return executeInsert(
    'INSERT INTO training_sessions (items_trained, results) VALUES (?, ?)',
    [JSON.stringify(items), JSON.stringify(results)]
  );
}

function completeTrainingSession(id) {
  execute('UPDATE training_sessions SET completed = 1 WHERE id = ?', [id]);
}

function saveSessionResults(id, results) {
  execute('UPDATE training_sessions SET results = ?, completed = 1 WHERE id = ?',
    [JSON.stringify(results), id]);
}

function getRecentSessions(days = 7) {
  return queryAll(
    `SELECT * FROM training_sessions
     WHERE session_date >= datetime('now', '-' || ? || ' days', 'localtime')
     ORDER BY session_date DESC`,
    [days]
  );
}

function getTrainingDaysInPeriod(days = 7) {
  const row = queryOne(
    `SELECT COUNT(DISTINCT date(session_date)) as days
     FROM training_sessions
     WHERE completed = 1
     AND session_date >= datetime('now', '-' || ? || ' days', 'localtime')`,
    [days]
  );
  return row ? row.days : 0;
}

// ── Settings ────────────────────────────────────────────────

function getSetting(key) {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = queryAll('SELECT * FROM settings');
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

function updateSetting(key, value) {
  execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
}

// ── Stats ───────────────────────────────────────────────────

function getCorpusStats() {
  const total = queryOne('SELECT COUNT(*) as count FROM items');
  const byType = queryAll('SELECT type, COUNT(*) as count FROM items GROUP BY type');
  const byLevel = queryAll(
    'SELECT mastery_level as level, COUNT(*) as count FROM items GROUP BY mastery_level ORDER BY mastery_level'
  );
  const mastered = queryOne('SELECT COUNT(*) as count FROM items WHERE mastery_level >= 6');
  const newThisWeek = queryOne(
    `SELECT COUNT(*) as count FROM items
     WHERE created_time >= datetime('now', '-7 days', 'localtime')`
  );

  return {
    total: total ? total.count : 0,
    byType,
    byLevel,
    mastered: mastered ? mastered.count : 0,
    newThisWeek: newThisWeek ? newThisWeek.count : 0,
  };
}

function getTodayStats() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Today's completed sessions
  const todaySessions = queryAll(
    `SELECT * FROM training_sessions
     WHERE completed = 1 AND date(session_date) = ?`,
    [today]
  );

  // Count today's questions and total scores
  let todayQuestions = 0;
  let totalAccuracy = 0;
  for (const s of todaySessions) {
    try {
      const results = JSON.parse(s.results || '[]');
      todayQuestions += results.length;
      for (const r of results) {
        totalAccuracy += (r.accuracy || 0);
      }
    } catch (e) { /* skip */ }
  }

  const todayAccuracy = todayQuestions > 0
    ? Math.round(totalAccuracy / todayQuestions)
    : 0;

  return {
    todayCompleted: todayQuestions,
    todayAccuracy,
    todaySessionsCount: todaySessions.length,
  };
}

function getStreak() {
  // Count consecutive days backwards from today
  const rowDates = queryAll(
    `SELECT DISTINCT date(session_date) as d FROM training_sessions
     WHERE completed = 1 ORDER BY d DESC`
  );

  if (rowDates.length === 0) return 0;

  // Build a set of dates with training
  const trainedDays = new Set(rowDates.map(r => r.d));

  // Count back from today until a gap is found
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;

  // Start from today and go backwards
  let check = new Date(today);
  while (trainedDays.has(check.toISOString().slice(0, 10))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  // If today doesn't have training yet, also check from yesterday
  // (so users don't lose streak if they haven't trained yet today)
  if (streak === 0) {
    check = new Date(today);
    check.setDate(check.getDate() - 1);
    while (trainedDays.has(check.toISOString().slice(0, 10))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
  }

  return streak;
}

module.exports = {
  initDB,
  getDB,
  upsertItem,
  getItems,
  getItemById,
  updateMasteryLevel,
  recordReview,
  deleteItemBySourceFile,
  getAllSourceFiles,
  createTrainingSession,
  completeTrainingSession,
  saveSessionResults,
  getRecentSessions,
  getTrainingDaysInPeriod,
  getSetting,
  getAllSettings,
  updateSetting,
  getCorpusStats,
  getTodayStats,
  getStreak,
};
