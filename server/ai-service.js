const { getSetting } = require('./db');

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';

function getAPIKey() {
  const key = getSetting('deepseekApiKey');
  if (!key) {
    throw new Error('DeepSeek API key not configured. Please set it in Settings.');
  }
  return key;
}

async function callDeepSeek(messages, { temperature = 0.7, maxTokens = 2048, jsonMode = false } = {}) {
  const apiKey = getAPIKey();
  const body = {
    model: MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
    // DeepSeek requires the prompt to contain 'json' when using json_object format
    const hasJson = messages.some(m =>
      m.content && m.content.toLowerCase().includes('json')
    );
    if (!hasJson) {
      messages = [
        { role: 'system', content: 'Respond in JSON format.' },
        ...messages,
      ];
    }
  }

  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || `DeepSeek API error: ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Parse corpus from markdown content
 * Input: raw markdown string
 * Output: [{content, type, context}]
 */
async function parseCorpus(markdownContent, fileName) {
  const systemPrompt = `You are an English language corpus analyzer. Your task is to extract English vocabulary, expressions, and sentence patterns from markdown notes.

Rules:
1. "word" - single English words or short phrases (2-3 words) that are vocabulary items
2. "expression" - idiomatic expressions, collocations, phrasal verbs (e.g., "cope with stress", "take for granted")
3. "pattern" - sentence structures or grammatical patterns (e.g., "Not only..., but also...", "It is not until... that...")

Return ONLY a JSON array. Each item must have:
- "content": the English text
- "type": "word" | "expression" | "pattern"
- "context": the surrounding sentence or context if available, otherwise null

Filter out:
- Common words (the, a, is, etc.)
- Non-English content
- Headers, dates, metadata

Example output:
[{"content": "overwhelmed", "type": "word", "context": "I felt overwhelmed by the workload"}, {"content": "cope with stress", "type": "expression", "context": null}]`;

  const userPrompt = `Parse the following markdown file (${fileName}) and extract all English vocabulary, expressions, and patterns:

\`\`\`markdown
${markdownContent}
\`\`\`

Return as JSON array.`;

  const response = await callDeepSeek(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.3, maxTokens: 4096, jsonMode: true }
  );

  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
    return [];
  } catch (err) {
    console.error('Failed to parse AI response:', response.substring(0, 200));
    return [];
  }
}

/**
 * Generate training tasks for a given item
 * Input: item object, target mode
 * Output: task object with prompt, options (for mode A), hint, required (for mode F)
 */
async function generateTask(item, mode) {
  const isPattern = item.type === 'pattern';

  const systemPrompt = isPattern
    ? `You are an English language training system specialized in SENTENCE PATTERN training. The user is learning a sentence structure/pattern. Do NOT use fill-in-the-blank exercises.

Training modes for sentence patterns:
- A (Recognition): Test understanding of the pattern's FUNCTION and WHEN to use it. Multiple choice (4 options) about the meaning, tone, or appropriate context.
- B (Recall): Given a Chinese description of the pattern and a scenario, ask user to RECONSTRUCT the English sentence pattern from memory.
- C (Imitation): Give the user a NEW context similar to where the pattern would be used. Ask them to write a sentence IMITATING the pattern structure. Show a similar example if helpful.
- D (Structure Rewriting): Give the user a simple/basic sentence. Ask them to REWRITE it using the target pattern to make it more sophisticated.
- E (Context Transfer): Give the user a completely NEW scenario/topic. Ask them to naturally incorporate the pattern into their response.
- F (Transfer Production): Ask user to write a short paragraph on a topic, using MULTIPLE specified patterns together naturally.

Return as JSON object with these fields:
- "prompt": the question or task instruction (string, in English or Chinese as appropriate)
- "options": array of 4 strings (ONLY for mode A, otherwise omit)
- "hint": a brief hint showing the pattern structure (e.g., "Pattern: Not only [A], but also [B]")
- "expectedAnswer": a reference answer for evaluation (string)`
    : `You are an English language training system. Generate training tasks based on the item and mode provided.

Training modes:
- A (Recognition): Test understanding. Generate a multiple-choice question about the meaning or usage. Provide 4 options.
- B (Recall): Given Chinese meaning, ask user to recall the English expression.
- C (Controlled Production): Provide a Chinese sentence containing the expression, ask user to translate to English.
- D (Guided Production): Ask a personal question that naturally requires using the expression.
- E (Free Production): Ask an open-ended question where the expression would be naturally used.
- F (Transfer Production): Combine multiple expressions. Ask user to write about a given topic using ALL specified expressions.

Return as JSON object with these fields:
- "prompt": the question or task instruction (string)
- "options": array of 4 strings (ONLY for mode A, otherwise omit)
- "hint": a brief hint to help the user (string, can be null)
- "expectedAnswer": a reference answer for evaluation (string)`;

  const userPrompt = `Generate a Mode ${mode} training task for:

Item: "${item.content}"
Type: ${item.type}
Current mastery level: ${item.mastery_level}

${isPattern ? 'This is a SENTENCE PATTERN. Design the task for imitation → rewriting → transfer, NOT fill-in-the-blank.' : ''}
${mode === 'F' ? 'For Transfer Production mode, also include required expressions list.' : ''}

Return as JSON.`;

  const response = await callDeepSeek(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.8, maxTokens: 2048, jsonMode: true }
  );

  try {
    return JSON.parse(response);
  } catch (err) {
    console.error('Failed to parse task generation response:', response.substring(0, 200));
    return {
      prompt: `Use "${item.content}" in a sentence.`,
      hint: `Type: ${item.type}`,
      expectedAnswer: item.content,
    };
  }
}

/**
 * Generate transfer task combining multiple expressions
 */
async function generateTransferTask(items) {
  const expressions = items.map(i => i.content);
  const systemPrompt = `You are an English language training system. Create a transfer production task that requires the user to naturally use multiple specified expressions in their response.

Return as JSON:
{
  "prompt": "A topic or scenario that naturally allows using all the expressions",
  "hint": "A brief encouraging hint",
  "expectedAnswer": "A sample answer that uses all expressions naturally"
}`;

  const userPrompt = `Create a transfer task requiring these expressions:
${expressions.map((e, i) => `${i + 1}. ${e}`).join('\n')}

The topic should be engaging and practical. Return JSON.`;

  const response = await callDeepSeek(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.9, maxTokens: 2048, jsonMode: true }
  );

  try {
    return JSON.parse(response);
  } catch (err) {
    return {
      prompt: `Write a short paragraph using ALL of these expressions: ${expressions.join(', ')}.`,
      hint: 'Try to connect them naturally.',
      expectedAnswer: '',
    };
  }
}

/**
 * Evaluate user's answer
 * Input: task, user answer
 * Output: {accuracy, naturalness, alternativeVersion, grammarSuggestions, usageEvaluation}
 */
async function evaluateAnswer(task, userAnswer, mode = 'A') {
  const isRecognition = mode === 'A';

  const systemPrompt = isRecognition
    ? `You are an English language evaluator. This is a RECOGNITION task — the user selected from multiple choices. Only evaluate whether they understood correctly.

Return as JSON:
{
  "accuracy": number 1-10 (did the user pick the correct meaning?),
  "usageEvaluation": "Confirm if the user understood correctly. (1 sentence)",
  "explanation": "If accuracy < 7: explain the expression clearly — its meaning, proper usage, and 1-2 example sentences in real context. If accuracy >= 7, set this to null.",
  "naturalness": null,
  "alternativeVersion": null,
  "grammarSuggestions": []
}

Be encouraging but honest. When the user makes mistakes, the explanation should help them truly understand and remember the expression.`
    : `You are an English language evaluator. This is a PRODUCTION task — the user wrote their own English. Evaluate accuracy, naturalness, and grammar.

Return as JSON:
{
  "accuracy": number 1-10 (how correctly the expression was used),
  "naturalness": number 1-10 (how natural/idiomatic the English sounds),
  "alternativeVersion": "A more natural version of the user's answer, if applicable. Otherwise null.",
  "grammarSuggestions": ["list", "of", "grammar", "issues"] or [],
  "usageEvaluation": "Brief evaluation: does this reach real communication level? (1-2 sentences)",
  "explanation": "If accuracy < 7: explain the expression clearly — its meaning, proper usage, and 1-2 example sentences in real context. If accuracy >= 7, set this to null."
}

Be encouraging but honest. When the user makes mistakes, the explanation should help them truly understand and remember the expression.`;

  const userPrompt = `Task: ${task.prompt}
${task.hint ? `Hint: ${task.hint}` : ''}
Expected expression: ${task.content || task.expectedAnswer || 'N/A'}

User's answer: "${userAnswer}"

Evaluate and return JSON.`;

  const response = await callDeepSeek(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 2048, jsonMode: true }
  );

  try {
    const result = JSON.parse(response);
    return {
      accuracy: result.accuracy || 5,
      naturalness: result.naturalness || null,
      alternativeVersion: result.alternativeVersion || null,
      grammarSuggestions: result.grammarSuggestions || [],
      usageEvaluation: result.usageEvaluation || '',
      explanation: result.explanation || null,
    };
  } catch (err) {
    console.error('Failed to parse evaluation response:', response.substring(0, 200));
    return {
      accuracy: 5,
      naturalness: null,
      alternativeVersion: null,
      grammarSuggestions: [],
      usageEvaluation: 'Unable to evaluate this response.',
      explanation: null,
    };
  }
}

/**
 * Test AI connection
 */
async function testAIConnection() {
  const response = await callDeepSeek(
    [
      { role: 'system', content: 'Reply with only this JSON: {"status":"ok","model":"deepseek-chat"}' },
      { role: 'user', content: 'Return a JSON response' },
    ],
    { temperature: 0, maxTokens: 100, jsonMode: true }
  );

  try {
    return JSON.parse(response);
  } catch {
    return { status: 'ok', model: 'deepseek-chat' };
  }
}

module.exports = {
  callDeepSeek,
  parseCorpus,
  generateTask,
  generateTransferTask,
  evaluateAnswer,
  testAIConnection,
};
