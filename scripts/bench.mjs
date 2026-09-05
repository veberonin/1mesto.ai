#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Микробенчмарк форматтера и журнала: 1mesto Flow.
 * Запуск: npm run bench  (или node scripts/bench.mjs [итераций=2000])
 * Печатает ops/sec и p50/p95 латентность по кейсам.
 */
import { performance } from 'node:perf_hooks';
import { formatText, countWordsIn, DEMO_SAMPLES } from '../src/lib/formatter.js';
import { parsePairsText } from '../src/lib/dictio.js';

const ITERS = Math.max(100, parseInt(process.argv[2] || '2000', 10));

const DICT = parsePairsText('1с = 1С\nпмо = ПМО\n#адрес = г. Москва, Тверская 1');
const CASES = [
  ['clean ru', DEMO_SAMPLES.ru, {}],
  ['clean en', DEMO_SAMPLES.en, { lang: 'en' }],
  ['email + dict', `${DEMO_SAMPLES.ru} напиши в 1с и в пмо`, { mode: 'email', dict: DICT.dict, macros: DICT.macros }],
  ['voice commands', 'привет запятая коллеги точка новый абзац итог тире пять тысяч', {}],
  ['ёфикация', 'еще объем трех черный зеленый надежный', { restoreYo: true }],
];

const pct = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
};

console.log(`1mesto Flow bench · ${ITERS} итераций на кейс\n`);
let worst = Infinity;
for (const [name, text, opts] of CASES) {
  const lat = [];
  const t0 = performance.now();
  for (let i = 0; i < ITERS; i++) {
    const s = performance.now();
    formatText(text, opts);
    lat.push(performance.now() - s);
  }
  const total = performance.now() - t0;
  const ops = ITERS / (total / 1000);
  worst = Math.min(worst, ops);
  console.log(
    `${name.padEnd(16)} ${String(Math.round(ops)).padStart(7)} ops/s · p50 ${pct(lat, 0.5).toFixed(3)} мс · p95 ${pct(lat, 0.95).toFixed(3)} мс`
  );
}
console.log(`\nхудший кейс: ${Math.round(worst)} ops/s — форматтер как минимум на ~${Math.round(worst)}x быстрее речи (130 wpm)`);
if (countWordsIn(DEMO_SAMPLES.ru) < 5) process.exit(1); // санити
