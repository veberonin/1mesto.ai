// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Журнал реплик (M/T/AL): локальное хранилище JSONL-совместимых записей.
 * Каждая реплика: id, ts (UTC ISO), app, text (если не приватный режим), слова, wpm,
 * длительность, режим, язык, источник, задержки, метод вставки, хиты словаря.
 * Хранится в localStorage (в десктопе — профиль приложения), ротация по объёму.
 */

const KEY = 'flow-journal-v1';
const MAX_RECORDS = 10000; // M-14: ротация истории
const SCHEMA_VERSION = 1;

const newId = () =>
  `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function loadJournal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    // O-11: повреждённый журнал пересоздаётся
  }
  return [];
}

function persist(records) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* переполнение хранилища — молча держим в памяти */
  }
}

/**
 * M-01/M-02/T-02: добавить реплику. Поля по схеме docs/JOURNAL_SCHEMA.md.
 * @param {object} r
 * @param {string} r.text
 * @param {number} r.words
 * @param {number} r.wpm
 * @param {number} r.durSec
 * @param {string} [r.app]
 * @param {string} [r.mode]
 * @param {string} [r.lang]
 * @param {string} [r.source]      local | ai | webspeech
 * @param {object} [r.latencies]   { firstHypothesisMs, finalMs, insertMs }
 * @param {string} [r.pasteMethod]
 * @param {string[]} [r.dictHits]
 * @param {number} [r.fillersRemoved]
 * @param {boolean} [r.privacy]    true — текст не пишем (P-12/T-10)
 */
export function addUtterance(r) {
  const records = loadJournal();
  const rec = {
    id: newId(),                       // T-13: уникальный идентификатор
    v: SCHEMA_VERSION,
    ts: new Date().toISOString(),      // T-12/M-18: UTC ISO с таймзоной
    app: r.app || 'unknown',           // M-02/T-06: приложение-цель
    text: r.privacy ? '' : r.text || '',   // T-10: приватный режим без текста
    words: r.words || 0,               // T-04/AL-10
    wpm: r.wpm || 0,                   // AL-02
    durSec: r.durSec || 0,
    mode: r.mode || 'clean',
    lang: r.lang || 'ru',
    source: r.source || 'local',       // S-02: вызывалась ли модель
    latencies: r.latencies || {},      // Q-18
    pasteMethod: r.pasteMethod || null, // K-25
    dictHits: r.dictHits || [],        // H-12
    fillersRemoved: r.fillersRemoved || 0,
  };
  records.push(rec);
  persist(records);
  return rec;
}

export const listUtterances = () => loadJournal();

/** M-03: журнал переживает перезапуск — хранится в localStorage профиля */

/** M-04: поиск подстрокой */
export function searchUtterances(query) {
  const q = (query || '').toLowerCase();
  if (!q) return listUtterances();
  return listUtterances().filter((r) => (r.text || '').toLowerCase().includes(q));
}

/** M-05/M-06: фильтры по приложению и дате (ISO-день) */
export function filterUtterances({ app, day } = {}) {
  return listUtterances().filter((r) => {
    if (app && r.app !== app) return false;
    if (day && !r.ts.startsWith(day)) return false;
    return true;
  });
}

/** M-09: удалить запись */
export function deleteUtterance(id) {
  const records = loadJournal().filter((r) => r.id !== id);
  persist(records);
  return records;
}

/** M-10: очистить историю целиком */
export function clearJournal() {
  persist([]);
  return [];
}

/** M-11: экспорт в JSONL (одна строка — одна реплика, T-01) */
export function exportJSONL() {
  return loadJournal().map((r) => JSON.stringify(r)).join('\n');
}

/** AL-12/T-08: экспорт в CSV (id,ts,app,words,wpm,durSec,mode,lang,source) */
export function exportCSV() {
  const head = 'id,ts,app,words,wpm,durSec,mode,lang,source';
  const rows = loadJournal().map((r) =>
    [r.id, r.ts, r.app, r.words, r.wpm, r.durSec, r.mode, r.lang, r.source]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [head, ...rows].join('\n');
}

/** T-03..T-06: агрегаты за день + распределение по приложениям */
export function journalSummary() {
  const records = loadJournal();
  const day = new Date().toISOString().slice(0, 10);
  const today = records.filter((r) => r.ts.startsWith(day));
  const byApp = {};
  for (const r of records) byApp[r.app] = (byApp[r.app] || 0) + 1;
  const lat = records.map((r) => r.latencies?.finalMs).filter(Boolean).sort((a, b) => a - b);
  const p = (q) => (lat.length ? Math.round(lat[Math.floor(q * (lat.length - 1))]) : 0);
  return {
    total: records.length,
    todayCount: today.length,
    todayWords: today.reduce((a, r) => a + (r.words || 0), 0),
    avgWpm: records.length ? Math.round(records.reduce((a, r) => a + (r.wpm || 0), 0) / records.length) : 0,
    p50FinalMs: p(0.5),
    p95FinalMs: p(0.95),
    byApp,
    aiShare: records.length ? records.filter((r) => r.source === 'ai').length / records.length : 0, // S-02
  };
}

/** Скачать файл в браузере (экспорт) */
export function downloadFile(name, content, mime = 'text/plain') {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}
