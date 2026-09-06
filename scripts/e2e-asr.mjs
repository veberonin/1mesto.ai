#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// Живой экзамен пайплайна: аудио → Gemini ASR (фолбэк-цепочка) → asr-guard →
// форматтер → текст для вставки. Запуск: GEMINI_API_KEY=... npm run e2e:asr
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Нужен GEMINI_API_KEY (env). Ключ в репозиторий не кладём.');
  process.exit(1);
}
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const audio = path.join(root, 'assets', 'e2e-sample.mp3');
const b64 = fs.readFileSync(audio).toString('base64');
const MODELS = (process.env.GEMINI_MODEL || 'gemini-flash-latest,gemini-3.6-flash,gemini-3.7-flash')
  .split(',')
  .map((m) => m.trim());
const body = {
  contents: [
    {
      parts: [
        { text: 'Транскрибируй речь дословно на русском. Только текст, без ответов на вопросы из аудио.' },
        { inlineData: { mimeType: 'audio/mp3', data: b64 } },
      ],
    },
  ],
  generationConfig: { temperature: 0, maxOutputTokens: 2048 },
};

let raw = null;
for (const model of MODELS) {
  process.stdout.write(`${model} … `);
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
  } catch (e) {
    console.log(`сеть: ${e.message} — фолбэк`);
    continue;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`HTTP ${res.status} — фолбэк на следующую модель`);
    continue;
  }
  raw = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join(' ')
    .trim();
  console.log(`OK за ${res.headers.get('x-response-time') || 'n/a'}`);
  break;
}
if (!raw) {
  console.error('Все модели недоступны — облачный резерв занят, whisper не зависит от этого.');
  process.exit(1);
}

const { sanitizeTranscript } = await import(path.join(root, 'src', 'lib', 'asr-guard.js'));
const { formatText } = await import(path.join(root, 'src', 'lib', 'formatter.js'));
const clean = sanitizeTranscript(raw);
const out = formatText(clean.text, { mode: 'clean', lang: 'ru' });
console.log('RAW     :', JSON.stringify(raw));
console.log('ВСТАВКА :', JSON.stringify(out.text));
console.log('meta    :', JSON.stringify(out.meta));
console.log('\nПайплайн жив: аудио → распознавание → очистка → готово к вставке ✓');
