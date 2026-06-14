/**
 * Markdown Parser for English Listening Notes
 *
 * Supports Chinese section headers and table/list formats
 * commonly used in Obsidian daily English notes.
 *
 * Supported formats:
 * - ### 核心词汇 / 核心单词 / 词汇  → table or list
 * - ### 高频短语 / 短语 / 表达      → table or list
 * - ### 实用句式 / 句型 / 句式      → table or list
 */

// Chinese section header patterns → item type
const SECTION_RE = {
  word: [
    /核心(?:词汇|单词)/,
    /(?:新学\s*)?(?:词汇|单词)/,
    /vocabulary/i,
    /words?/i,
  ],
  expression: [
    /高频短语/,
    /(?:实用|高频|固定)?短语/,
    /(?:高频|常用)?表达/,
    /固定搭配/,
    /expressions?/i,
    /phrases?/i,
    /collocations?/i,
  ],
  pattern: [
    /实用句式/,
    /(?:句子|句型|句式|结构)/,
    /patterns?/i,
    /structures?/i,
  ],
};

// Check if a line is a header matching one of the section types
function matchSection(line) {
  // Remove markdown header markers and trim
  const cleaned = line.replace(/^#{1,4}\s*/, '').replace(/\*{1,2}/g, '').trim();
  if (!cleaned) return null;

  for (const [type, patterns] of Object.entries(SECTION_RE)) {
    for (const re of patterns) {
      if (re.test(cleaned)) return type;
    }
  }
  return null;
}

// Check if this line is any kind of header
function isAnyHeader(line) {
  return /^#{1,4}\s+/.test(line.trim());
}

// Check if line is a table separator (e.g., |---|---|)
function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

// Check if line is a table data row (e.g., | word | definition |)
function isTableRow(line) {
  return /^\|.+\|$/.test(line.trim());
}

// Extract first column from table row (the English word/phrase)
function extractTableFirstCol(line) {
  const cells = line.split('|').map(s => s.trim()).filter(Boolean);
  return cells.length > 0 ? cells[0] : null;
}

// Check if line is a list item
function isListItem(line) {
  return /^[\s]*[-*+]\s+/.test(line) || /^[\s]*\d+[.)]\s+/.test(line);
}

// Extract English content from a list item
// e.g., "- in the foreign service 在外交服务领域" → "in the foreign service"
function extractListEnglish(line) {
  // Remove list marker
  let content = line.replace(/^[\s]*[-*+]\s+/, '').replace(/^[\s]*\d+[.)]\s+/, '').trim();

  // Remove markdown formatting
  content = content.replace(/[*_~`]+/g, '').trim();

  // Remove Chinese characters and common Chinese punctuation after the English part
  // Strategy: find where Chinese starts and take everything before it
  const chineseStart = content.search(/[一-鿿㐀-䶿]/);
  if (chineseStart > 0) {
    content = content.substring(0, chineseStart).trim();
  }

  return content;
}

// Clean extracted content
function cleanContent(text) {
  if (!text) return null;
  return text
    .replace(/^[*_`"']+|[*_`"']+$/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .trim();
}

// Check if content is valid English learning material
function isValidEnglishContent(text) {
  if (!text || text.length < 1 || text.length > 300) return false;

  // Must contain at least some English letters
  if (!/[a-zA-Z]/.test(text)) return false;

  // Skip purely Chinese
  if (/^[一-鿿㐀-䶿\s，。、；：""''！？【】（）]+$/.test(text)) return false;

  // Skip URLs
  if (/^https?:\/\//.test(text)) return false;

  // Skip date-only lines
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return false;

  // Skip common metadata
  if (/^(created|modified|tags|aliases):/i.test(text)) return false;

  // Skip lines that are just punctuation or symbols
  if (/^[\s\-–—•·★☆✏️📝💡①②③④⑤⑥⑦⑧⑨⑩]+$/.test(text)) return false;

  return true;
}

/**
 * Parse a single markdown file's content
 * @param {string} content - Raw markdown content
 * @returns {{type: string, content: string}[]} Array of parsed items
 */
function parseMarkdown(content) {
  const lines = content.split('\n');
  const items = [];
  let currentType = null;
  let inTable = false;
  let tableHeaderSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (but don't reset table state)
    if (!trimmed) continue;

    // --- Table handling ---
    if (isTableSeparator(trimmed)) {
      if (inTable) tableHeaderSkipped = true;
      continue;
    }

    if (isTableRow(trimmed)) {
      if (!inTable) {
        // First table row is the header — skip it
        inTable = true;
        tableHeaderSkipped = true;
        continue;
      }
      if (tableHeaderSkipped && currentType) {
        const cell = extractTableFirstCol(trimmed);
        const cleaned = cleanContent(cell);
        if (cleaned && isValidEnglishContent(cleaned)) {
          items.push({ type: currentType, content: cleaned });
        }
      }
      continue;
    }

    // Exiting table
    if (inTable && !isTableRow(trimmed)) {
      inTable = false;
      tableHeaderSkipped = false;
    }

    // --- Section header detection ---
    if (isAnyHeader(trimmed)) {
      const matchedType = matchSection(trimmed);
      if (matchedType) {
        currentType = matchedType;
      }
      // For non-matching headers, keep currentType (subsections under a word/expression section)
      inTable = false;
      tableHeaderSkipped = false;
      continue;
    }

    // --- Horizontal rules, metadata ---
    if (/^[-_*]{3,}\s*$/.test(trimmed)) continue;

    // --- List items ---
    if (isListItem(trimmed) && currentType) {
      const english = extractListEnglish(trimmed);
      const cleaned = cleanContent(english);
      if (cleaned && isValidEnglishContent(cleaned)) {
        items.push({ type: currentType, content: cleaned });
      }
      continue;
    }
  }

  // Deduplicate
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.type}:${item.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { parseMarkdown };
