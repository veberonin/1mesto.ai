// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

// Единый умный форматер с фронтендом — один код для веба, API и тестов
import { formatText } from '../src/lib/formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// AN-08: простой query-парсер — убирает DoS-поверхность qs (вложенные скобки),
// API работает на JSON-телах, сложные query нам не нужны
app.set('query parser', 'simple');
// CORS-список источников (рекомендация организаторов, прогон 14):
// по умолчанию только локальные дев-хосты и наш GitHub Pages; прочие origins
// не получают CORS-заголовков. Расширяется env CORS_ORIGINS через запятую.
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000,https://veberonin.github.io'
)
  .split(',')
  .map((x) => x.trim().replace(/\/$/, ''));
app.use(
  cors({
    origin(origin, cb) {
      // без Origin (desktop/curl/CLI) — пропускаем; чужой origin — без CORS-заголовков
      if (!origin) return cb(null, true);
      return cb(null, CORS_ORIGINS.includes(origin.replace(/\/$/, '')));
    },
  })
);
// V-08: если задан API_TOKEN — все методы кроме /api/health требуют Bearer-токен
if (process.env.API_TOKEN) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.API_TOKEN}`) {
      return res.status(401).json({ error: 'нужен Authorization: Bearer <API_TOKEN>' });
    }
    return next();
  });
}
// AF-06: ограничение частоты запросов (настраивается RATE_LIMIT, по умолчанию 120/мин на IP)
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 120;
const rateBuckets = new Map();
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const b = rateBuckets.get(ip) || { n: 0, reset: now + 60000 };
  if (now > b.reset) {
    b.n = 0;
    b.reset = now + 60000;
  }
  b.n += 1;
  rateBuckets.set(ip, b);
  if (rateBuckets.size > 10000) rateBuckets.clear(); // защита от роста карты
  if (b.n > RATE_LIMIT) {
    return res.status(429).json({ error: `лимит ${RATE_LIMIT} запросов/мин — подожди минуту` });
  }
  return next();
});
// AN-07: лимит тела — публичный сервер не должен съедать память
// (8МБ хватает на ~5 минут webm-аудио для /api/transcribe, base64 в JSON)
app.use(express.json({ limit: '8mb' }));
app.use((err, _req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'тело запроса больше 8МБ' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'некорректный JSON' });
  }
  return next(err);
});

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
// AI-полировка: Gemini / OpenAI / Ollama (локально). Ключ — из env или заголовка.
// ---------------------------------------------------------------------------
function buildPrompt(text, mode, language) {
  const langName = language === 'en' ? 'English' : 'Russian';
  const modeHint =
    {
      clean: 'Standard clean text with proper punctuation and grammar.',
      email: 'Professional email with greeting and sign-off.',
      bullets: 'Concise bullet-point list of key points.',
      chat: 'Friendly casual chat message.',
      code: 'Clean technical note; wrap tech terms in backticks.',
    }[mode] || 'Standard clean text.';

  return `You are Flow, a voice-dictation formatter (like Wispr Flow).
Rules:
1. Remove filler words ("эм", "ну", "как бы", "um", "uh", "like", "you know").
2. Fix punctuation, capitalization and grammar.
3. Style: ${modeHint}
4. Output language: ${langName}.
5. Return ONLY the formatted text, no explanations, no markdown fences.

Transcript: """${text}"""`;
}

async function withTimeout(promiseFn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promiseFn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function aiFormat(text, mode, language, provider, key) {
  const prompt = buildPrompt(text, mode, language);

  if (provider === 'openai') {
    const data = await withTimeout(
      (signal) =>
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
          }),
        }).then((r) => r.json()),
      25000
    );
    const out = data?.choices?.[0]?.message?.content;
    return out
      ? out
          .replace(/^```[a-z]*\n?/i, '')
          .replace(/```$/, '')
          .trim()
      : null;
  }

  if (provider === 'ollama') {
    // Локальная модель — бесплатно и офлайн. Нужен запущенный Ollama: `ollama serve`
    const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
    const model = process.env.OLLAMA_MODEL || 'llama3.1';
    try {
      const data = await withTimeout(
        (signal) =>
          fetch(`${base}/api/chat`, {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              stream: false,
              options: { temperature: 0.2 },
              messages: [
                {
                  role: 'system',
                  content: 'You are Flow, a voice dictation formatter. Output only the formatted text.',
                },
                { role: 'user', content: prompt },
              ],
            }),
          }).then((r) => r.json()),
        8000
      );
      const out = data?.message?.content;
      return out
        ? out
            .replace(/^```[a-z]*\n?/i, '')
            .replace(/```$/, '')
            .trim()
        : null;
    } catch {
      return null; // Ollama не запущена — тихо падаем на локальный форматер
    }
  }

  // Gemini (по умолчанию)
  const models = (process.env.GEMINI_MODEL || 'gemini-flash-latest,gemini-3.6-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  for (const model of models) {
    try {
      const data = await withTimeout(
        (signal) =>
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: 'POST',
              signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: Number(process.env.GEMINI_MAX_TOKENS || 1024),
                },
              }),
            }
          ).then((r) => r.json()),
        25000
      );
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (out)
        return out
          .replace(/^```[a-z]*\n?/i, '')
          .replace(/```$/, '')
          .trim();
    } catch {
      /* пробуем следующую модель */
    }
  }
  return null;
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
      gemini: !!process.env.GEMINI_API_KEY, // V: ключи клиентов не ретранслируются — только env сервера
      openai: !!process.env.OPENAI_API_KEY,
      ollama: !!(process.env.OLLAMA_URL || req.headers['x-ai-provider'] === 'ollama'),
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

// T-15: сводка прогона одной командой (npm run summary)
app.get('/api/summary', (req, res) => {
  const db = readDb();
  const day = new Date().toISOString().slice(0, 10);
  const today = db.sessions.filter((x) => (x.timestamp || '').startsWith(day));
  const lat = db.sessions
    .map((x) => x.averageWpm)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const byMode = {};
  for (const x of db.sessions) byMode[x.mode] = (byMode[x.mode] || 0) + 1;
  res.json({
    totalSessions: db.sessions.length,
    todaySessions: today.length,
    todayWords: today.reduce((a, x) => a + (x.wordCount || 0), 0),
    totalWords: db.sessions.reduce((a, x) => a + (x.wordCount || 0), 0),
    medianWpm: lat.length ? lat[Math.floor((lat.length - 1) / 2)] : 0,
    byMode,
  });
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
    if (text !== undefined && text !== null && typeof text !== 'string') {
      return res.status(400).json({ error: 'поле text должно быть строкой' });
    }
    if (!text || !text.trim()) return res.json({ formattedText: '', source: 'local' });

    // P-04/P-08: облако ТОЛЬКО по явному выбору клиента (заголовок x-ai-provider).
    // Наличие серверного ключа само по себе постобработку не включает —
    // путь реплики по умолчанию полностью локальный и не обращается в сеть.
    const provider = req.headers['x-ai-provider'] || 'none';
    // V-заметка: ключ берётся ТОЛЬКО из env сервера. Клиентский ключ передаётся
    // провайдеру напрямую из десктоп-приложения, сервер как прокси ключей не используется.
    const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (provider !== 'none' && (key || provider === 'ollama')) {
      const aiText = await aiFormat(text, mode, language, provider, key);
      if (aiText) return res.json({ formattedText: aiText, source: 'ai' });
    }

    // Локальный умный форматер — всегда доступен, работает офлайн (+ словарь/макросы, H-01)
    const local = formatText(text, {
      mode,
      lang: language === 'en' ? 'en' : 'ru',
      name: req.body?.name || '',
      dict: req.body?.dict && typeof req.body.dict === 'object' ? req.body.dict : null,
      macros: req.body?.macros && typeof req.body.macros === 'object' ? req.body.macros : null,
      voiceCommands: req.body?.voiceCommands !== false,
      restoreYo: !!req.body?.restoreYo,
    });
    return res.json({ formattedText: local.text, meta: local.meta, source: 'local' });
  } catch (e) {
    console.error('format error:', e.message);
    res.status(500).json({ error: e.message, formattedText: (req.body && req.body.text) || '' });
  }
});

// Транскрибация аудио (WAV base64) через Gemini — фолбэк для веб-версии
app.post('/api/transcribe', async (req, res) => {
  const key = process.env.GEMINI_API_KEY; // V: без ретрансляции клиентских ключей
  const { audio, lang = 'ru' } = req.body || {};
  if (!audio) return res.status(400).json({ error: 'нет поля audio (base64 wav/webm) в теле запроса' });
  if (!key) return res.status(501).json({ error: 'no GEMINI_API_KEY on server' });
  try {
    const model = (process.env.GEMINI_MODEL || 'gemini-flash-latest').split(',')[0].trim();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Транскрибируй речь дословно на ${lang === 'en' ? 'английском' : 'русском'}. Только текст.`,
                },
                { inlineData: { mimeType: 'audio/wav', data: audio } },
              ],
            },
          ],
        }),
      }
    );
    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join(' ')
      .trim();
    if (!text) return res.status(502).json({ error: 'empty' });
    res.json({ text: text.trim(), source: 'gemini' });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

// Слушаем порт только при прямом запуске (не при импорте из тестов)
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  // O-13: занятый порт не блокирует старт — вторая копия молча продолжает работу без сервера
  process.on('uncaughtException', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error('[1mesto Flow] порт занят другой копией — работаю без сервера');
      process.exit(0);
    }
    console.error('[1mesto Flow] непредвиденная ошибка:', err && err.message);
    process.exit(1);
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
    console.log(`[1mesto Flow] API server: http://localhost:${PORT}`);
  });
}

export default app;
