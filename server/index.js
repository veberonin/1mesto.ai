require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ---------------------------------------------------------------------------
// Хранилище: простой JSON-файл (не требует MongoDB — запускается везде).
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { sessions: [] };
  }
}
function writeDb(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Failed to persist db:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Лёгкий локальный форматер (зеркало клиентского, на случай вызова API напрямую)
// ---------------------------------------------------------------------------
const RU_FILLERS = ['эм', 'эээ', 'мм', 'ммм', 'ну', 'вот', 'типа', 'как бы', 'это самое', 'короче', 'в общем'];
const EN_FILLERS = ['um', 'uh', 'erm', 'hmm', 'like', 'you know', 'i mean', 'basically'];

function localFormat(text, mode, language) {
  const isRu = language !== 'en';
  const fillers = isRu ? RU_FILLERS : EN_FILLERS;
  const Lb = '(?<![\\p{L}\\p{N}])';
  const Rb = '(?![\\p{L}\\p{N}])';
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let out = ' ' + text + ' ';
  for (const f of [...fillers].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`${Lb}${esc(f)}${Rb}`, 'giu'), ' ');
  }
  out = out
    .replace(new RegExp(`${Lb}(точка|period|full stop)${Rb}`, 'giu'), ' . ')
    .replace(new RegExp(`${Lb}(запятая|comma)${Rb}`, 'giu'), ' , ')
    .replace(new RegExp(`${Lb}(восклицательный знак|exclamation (?:mark|point))${Rb}`, 'giu'), ' ! ')
    .replace(new RegExp(`${Lb}(вопросительный знак|question mark)${Rb}`, 'giu'), ' ? ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const sentences = out
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?]$/.test(s) ? cap(s) : cap(s) + '.'));

  if (!sentences.length) return '';

  switch (mode) {
    case 'email':
      return `${isRu ? 'Добрый день!' : 'Hi there!'}\n\n${sentences.join(' ')}\n\n${isRu ? 'С уважением' : 'Best regards'},\n${isRu ? 'Команда 1mesto' : 'Team 1mesto'}`;
    case 'bullets':
      return sentences.map((s) => `•  ${s.replace(/[.]$/, '')}`).join('\n');
    case 'chat':
      return sentences.map((s) => s.replace(/\.$/, '')).join('. ') + ' 🙂';
    default:
      return sentences.join(' ');
  }
}

// ---------------------------------------------------------------------------
// AI-полировка: Gemini или OpenAI. Ключ — из env или заголовка x-api-key.
// ---------------------------------------------------------------------------
async function aiFormat(text, mode, language, provider, key) {
  const langName = language === 'en' ? 'English' : 'Russian';
  const modeHint = {
    clean: 'Standard clean text with proper punctuation and grammar.',
    email: 'Professional email with greeting and sign-off.',
    bullets: 'Concise bullet-point list of key points.',
    chat: 'Friendly casual chat message.',
    code: 'Clean technical note; wrap tech terms in backticks.',
  }[mode] || 'Standard clean text.';

  const prompt = `You are Flow, a voice-dictation formatter (like Wispr Flow).
Rules:
1. Remove filler words ("эм", "ну", "как бы", "um", "uh", "like", "you know").
2. Fix punctuation, capitalization and grammar.
3. Style: ${modeHint}
4. Output language: ${langName}.
5. Return ONLY the formatted text, no explanations, no markdown fences.

Transcript: """${text}"""`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    let out = null;
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      out = data?.choices?.[0]?.message?.content;
    } else {
      const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );
          const data = await res.json();
          out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (out) break;
        } catch (e) {
          /* пробуем следующую модель */
        }
      }
    }
    if (!out) return null;
    return out.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const db = readDb();
  res.json({
    ok: true,
    storage: 'json',
    sessions: db.sessions.length,
    ai: {
      gemini: !!(process.env.GEMINI_API_KEY || req.headers['x-api-key']),
      openai: !!process.env.OPENAI_API_KEY,
    },
  });
});

app.post('/api/stats', (req, res) => {
  const { durationSeconds, wordCount, averageWpm, maxWpm, language, mode } = req.body || {};
  const db = readDb();
  db.sessions.push({
    ts: Date.now(),
    timestamp: new Date().toISOString(),
    durationSeconds: durationSeconds || 0,
    wordCount: wordCount || 0,
    averageWpm: averageWpm || 0,
    maxWpm: maxWpm || 0,
    language: language || 'ru',
    mode: mode || 'clean',
  });
  if (db.sessions.length > 500) db.sessions = db.sessions.slice(-500);
  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  const db = readDb();
  const sessions = db.sessions.slice(-100).reverse();
  let totalWords = 0;
  let maxWpmRecord = 0;
  let wpmSum = 0;
  for (const s of db.sessions) {
    totalWords += s.wordCount || 0;
    maxWpmRecord = Math.max(maxWpmRecord, s.maxWpm || 0, s.averageWpm || 0);
    wpmSum += s.averageWpm || 0;
  }
  res.json({
    totalWords,
    totalSessions: db.sessions.length,
    maxWpmRecord,
    avgSessionWpm: db.sessions.length ? Math.round(wpmSum / db.sessions.length) : 0,
    recentSessions: sessions,
  });
});

app.post('/api/format', async (req, res) => {
  try {
    const { text, mode, language } = req.body || {};
    if (!text || !text.trim()) return res.json({ formattedText: '', source: 'local' });

    const provider = req.headers['x-ai-provider'] || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'none');
    const key = req.headers['x-api-key'] || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (provider !== 'none' && key) {
      const aiText = await aiFormat(text, mode, language, provider, key);
      if (aiText) return res.json({ formattedText: aiText, source: 'ai' });
    }

    return res.json({ formattedText: localFormat(text, mode, language), source: 'local' });
  } catch (e) {
    console.error('format error:', e.message);
    res.status(500).json({ error: e.message, formattedText: (req.body && req.body.text) || '' });
  }
});

// ---------------------------------------------------------------------------
// Статика фронтенда (prod-сборка) + SPA fallback
// ---------------------------------------------------------------------------
const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(200).send('1mesto Flow API работает. Фронтенд не собран: npm run build');
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[1mesto Flow] API server: http://localhost:${PORT}`);
});
