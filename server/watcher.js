const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { getSetting } = require('./db');
const { parseMarkdown } = require('./parser');
const { parseCorpus } = require('./ai-service');
const { upsertItem, deleteItemBySourceFile } = require('./db');

let watcher = null;
let isScanning = false;

/**
 * Get the configured Obsidian folder path
 */
function getObsidianPath() {
  const p = getSetting('obsidianPath');
  if (!p || !p.trim()) {
    throw new Error('Obsidian folder path not configured.');
  }
  return p.trim();
}

/**
 * Parse a single markdown file and import its items
 */
async function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    // Step 1: Basic markdown parsing
    const rawItems = parseMarkdown(content);

    if (rawItems.length === 0) {
      console.log(`  📄 ${fileName}: No English items found`);
      return { file: fileName, itemsFound: 0 };
    }

    // Step 2: AI-enhanced parsing for better classification
    let aiItems;
    try {
      aiItems = await parseCorpus(content, fileName);
    } catch (err) {
      console.warn(`  ⚠️ AI parsing failed for ${fileName}, using basic parser:`, err.message);
      aiItems = rawItems;
    }

    // Merge: prefer AI items, fall back to raw items
    const allItems = aiItems.length > 0 ? aiItems : rawItems;

    // Step 3: Upsert into database
    let addedCount = 0;
    for (const item of allItems) {
      if (item.content && item.type) {
        upsertItem({
          content: item.content,
          type: item.type,
          source_file: fileName,
          source_context: item.context || null,
        });
        addedCount++;
      }
    }

    console.log(`  ✅ ${fileName}: ${addedCount} items`);
    return { file: fileName, itemsFound: addedCount };
  } catch (err) {
    console.error(`  ❌ Error processing ${filePath}:`, err.message);
    return { file: path.basename(filePath), itemsFound: 0, error: err.message };
  }
}

/**
 * Remove items from a specific source file
 */
function removeFileItems(filePath) {
  const fileName = path.basename(filePath);
  deleteItemBySourceFile(fileName);
  console.log(`  🗑️ Removed items from: ${fileName}`);
}

/**
 * Scan all markdown files in the Obsidian folder
 */
async function scanAllFiles() {
  if (isScanning) {
    return { status: 'already-scanning' };
  }

  isScanning = true;
  try {
    const obsidianPath = getObsidianPath();

    if (!fs.existsSync(obsidianPath)) {
      throw new Error(`Folder not found: ${obsidianPath}`);
    }

    const files = fs
      .readdirSync(obsidianPath)
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.join(obsidianPath, f));

    console.log(`\n🔍 Scanning ${files.length} markdown files in: ${obsidianPath}`);

    const results = [];
    for (const file of files) {
      const result = await processFile(file);
      results.push(result);
    }

    const addedCount = results.filter((r) => r.itemsFound > 0).length;
    const updatedCount = results.length;
    const totalProcessed = results.reduce((sum, r) => sum + r.itemsFound, 0);

    console.log(`✅ Scan complete: ${totalProcessed} items from ${results.length} files\n`);

    return {
      status: 'complete',
      totalProcessed,
      addedCount,
      updatedCount,
      files: results,
    };
  } finally {
    isScanning = false;
  }
}

/**
 * Initialize file watcher
 */
async function initWatcher() {
  try {
    const obsidianPath = getObsidianPath();
    return startWatcher(obsidianPath);
  } catch (err) {
    // Settings not configured yet — that's ok
    console.log('  ℹ️ Watcher not started (no path configured)');
    return null;
  }
}

/**
 * Start watching a folder
 */
function startWatcher(folderPath) {
  if (watcher) {
    watcher.close();
  }

  if (!fs.existsSync(folderPath)) {
    console.warn(`  ⚠️ Folder does not exist: ${folderPath}`);
    return null;
  }

  console.log(`👀 Watching: ${folderPath}`);

  watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher
    .on('add', (filePath) => {
      if (filePath.endsWith('.md')) {
        console.log(`📝 New file detected: ${path.basename(filePath)}`);
        processFile(filePath);
      }
    })
    .on('change', (filePath) => {
      if (filePath.endsWith('.md')) {
        console.log(`🔄 File changed: ${path.basename(filePath)}`);
        processFile(filePath);
      }
    })
    .on('unlink', (filePath) => {
      if (filePath.endsWith('.md')) {
        console.log(`❌ File removed: ${path.basename(filePath)}`);
        removeFileItems(filePath);
      }
    });

  return watcher;
}

/**
 * Reinitialize watcher (called when settings change)
 */
async function reinitWatcher() {
  try {
    const obsidianPath = getObsidianPath();
    startWatcher(obsidianPath);
    // Also do an initial scan
    await scanAllFiles();
  } catch (err) {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    throw err;
  }
}

module.exports = {
  initWatcher,
  reinitWatcher,
  scanAllFiles,
  processFile,
};
