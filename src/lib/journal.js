// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Журнал реплик (M/T/AL): локальное хранилище JSONL-совместимых записей.
 * Каждая реплика: id, ts (UTC ISO), app, text (если не приватный режим), слова, wpm,
 * длительность, режим, язык, источник, задержки, метод вставки, хиты словаря.
 * Хранится в localStorage (в десктопе — профиль приложения), ротация по объёму.
 */

const KEY = 'flow-journal-v1';
const CRYPT_KEY = 'flow-journal-crypt-v1'; // M-17: соль+верификатор (без ключа и пароля)
const MAX_RECORDS = 10000; // M-14: ротация истории
const SCHEMA_VERSION = 1;

// M-17: ключ живёт только в памяти сессии; на диске — шифрованные тексты
let cipher = null;
let memRecords = null; // расшифрованный кеш (истина при разблокированной сессии)
let lastPersistedRaw = null; // контроль внешних изменений хранилища
let cryptoMod = null;
async function ensureCrypto() {
  if (!cryptoMod) cryptoMod = await import('./crypto.js');
  return cryptoMod;
}
const readCryptMeta = () => {
  try {
    const raw = localStorage.getItem(CRYPT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const newId = () => `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Читает диск как есть (без расшифровки) — внутреннее */
function loadJournalRaw() {
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

/**
 * M-17: публичное чтение. При разблокированной сессии отдаёт расшифрованные
 * записи из памяти; на холодном старте с включённым шифрованием записи
 * приходят с текстом '' и полем enc — до unlockJournal(passphrase).
 */
export function loadJournal() {
  // внешние изменения хранилища (тесты, импорт) — кеш перевалидируется по диску
  const raw = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();
  if (memRecords && raw === lastPersistedRaw) return memRecords;
  memRecords = loadJournalRaw();
  lastPersistedRaw = raw;
  return memRecords;
}

function persistPlain(records) {
  const kept = records.slice(-MAX_RECORDS);
  const raw = JSON.stringify(kept);
  try {
    localStorage.setItem(KEY, raw);
    lastPersistedRaw = raw;
  } catch {
    /* переполнение хранилища — молча держим в памяти */
  }
  memRecords = kept; // память согласована с диском (ротация M-14)
}

/** M-17:persist с шифрованием текстов на диске; в памяти остаётся открытый текст */
async function persistEncrypted() {
  const cm = await ensureCrypto();
  const recs = loadJournal().slice(-MAX_RECORDS);
  const out = [];
  for (const r of recs) {
    if (r.enc) {
      out.push(r);
      continue;
    }
    const box = await cm.encryptString(r.text || '', cipher);
    out.push({ ...r, text: '', enc: box });
  }
  memRecords = recs;
  const raw = JSON.stringify(out);
  try {
    localStorage.setItem(KEY, raw);
    lastPersistedRaw = raw;
  } catch {
    /* переполнение хранилища */
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
    id: newId(), // T-13: уникальный идентификатор
    v: SCHEMA_VERSION,
    ts: new Date().toISOString(), // T-12/M-18: UTC ISO с таймзоной
    app: r.app || 'unknown', // M-02/T-06: приложение-цель
    text: r.privacy ? '' : r.text || '', // T-10: приватный режим без текста
    words: r.words || 0, // T-04/AL-10
    wpm: r.wpm || 0, // AL-02
    durSec: r.durSec || 0,
    mode: r.mode || 'clean',
    lang: r.lang || 'ru',
    source: r.source || 'local', // S-02: вызывалась ли модель
    interims: r.interims || 0, // E-09: промежуточных гипотез за реплику (потоковая подача)
    latencies: r.latencies || {}, // Q-18
    pasteMethod: r.pasteMethod || null, // K-25
    dictHits: r.dictHits || [], // H-12
    fillersRemoved: r.fillersRemoved || 0,
  };
  records.push(rec);
  if (cipher) {
    persistEncrypted(); // M-17: на диск — шифрованно, в памяти — открытый текст
  } else {
    persistPlain(records);
  }
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
  memRecords = records; // пишущая операция обязана обновлять кеш
  if (cipher) {
    persistEncrypted(); // M-17
  } else {
    persistPlain(records);
  }
  return records;
}

/** M-10: очистить историю целиком */
export function clearJournal() {
  memRecords = []; // сбрасываем кеш — иначе loadJournal вернёт старое
  persistPlain([]);
  return [];
}

/** M-11: экспорт в JSONL (одна строка — одна реплика, T-01) */
export function exportJSONL() {
  return loadJournal()
    .map((r) => JSON.stringify(r))
    .join('\n');
}

/** AL-12/T-08: экспорт в CSV (id,ts,app,words,wpm,durSec,mode,lang,source) */
/** Экспорт журнала в JSON (полная копия данных) */
export function exportJSON() {
  return JSON.stringify(loadJournal(), null, 2);
}

/** Экспорт журнала в Markdown-таблицу (для отчётов и заметок) */
export function exportMarkdown() {
  const recs = loadJournal();
  const lines = [
    '# Журнал диктовки — 1mesto Flow',
    '',
    `Реплик: ${recs.length}`,
    '',
    '| Дата | Приложение | Слов | WPM | Длит. | Режим | Язык |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of recs) {
    const date = new Date(r.ts).toLocaleString('ru-RU');
    const dur = `${Math.round(r.durSec || 0)} c`;
    const cells = [date, r.app || '—', r.words ?? 0, r.wpm ?? 0, dur, r.mode || '—', r.lang || '—'];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

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
  // AL-09: средняя скорость по приложениям { app: { count, avgWpm } }
  const acc = {};
  for (const r of records) {
    if (!r.wpm) continue;
    const k = r.app || 'unknown';
    acc[k] = acc[k] || { sum: 0, n: 0 };
    acc[k].sum += r.wpm;
    acc[k].n += 1;
  }
  const wpmByApp = Object.fromEntries(
    Object.entries(acc).map(([k, v]) => [k, { count: v.n, avgWpm: Math.round(v.sum / v.n) }])
  );
  const lat = records
    .map((r) => r.latencies?.finalMs)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const p = (q) => (lat.length ? Math.round(lat[Math.floor(q * (lat.length - 1))]) : 0);
  return {
    total: records.length,
    todayCount: today.length,
    todayWords: today.reduce((a, r) => a + (r.words || 0), 0),
    avgWpm: records.length ? Math.round(records.reduce((a, r) => a + (r.wpm || 0), 0) / records.length) : 0,
    p50FinalMs: p(0.5),
    p95FinalMs: p(0.95),
    byApp,
    wpmByApp, // AL-09: средняя скорость по приложениям
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

// ---------------------------------------------------------------------------
// M-17: шифрование журнала по настройке
// ---------------------------------------------------------------------------

/** Включить шифрование: все тексты перезаписываются шифрованными (AES-GCM) */
export async function enableJournalEncryption(passphrase) {
  if (!passphrase || typeof passphrase !== 'string' || passphrase.length < 4) {
    return { ok: false, reason: 'Пароль от 4 символов' };
  }
  const cm = await ensureCrypto();
  const { key, salt, verifier } = await cm.setupEncryption(passphrase);
  cipher = key;
  memRecords = null; // перечитаем диск и перезашифруем
  try {
    localStorage.setItem(CRYPT_KEY, JSON.stringify({ v: 1, salt, verifier }));
  } catch {
    return { ok: false, reason: 'Хранилище недоступно' };
  }
  await persistEncrypted();
  return { ok: true };
}

/** Выключить шифрование: расшифровать всё на диск (нужна та же фраза) */
export async function disableJournalEncryption(passphrase) {
  const meta = readCryptMeta();
  if (!meta) return { ok: false, reason: 'Шифрование не включено' };
  const cm = await ensureCrypto();
  if (!(await cm.verifyPassphrase(passphrase, meta.salt, meta.verifier))) {
    return { ok: false, reason: 'Неверный пароль' };
  }
  const { key } = await cm.setupEncryption(passphrase, meta.salt);
  const recs = loadJournalRaw();
  const out = [];
  for (const r of recs) {
    if (!r.enc) {
      out.push(r);
      continue;
    }
    const text = await cm.decryptString(r.enc, key);
    out.push({ ...r, text: text ?? '', enc: undefined });
  }
  cipher = null;
  memRecords = out;
  try {
    localStorage.removeItem(CRYPT_KEY);
    localStorage.setItem(KEY, JSON.stringify(out.slice(-MAX_RECORDS)));
  } catch {
    /* переполнение — оставляем как вышло */
  }
  return { ok: true };
}

/** Разблокировать журналы фразой (холодный старт при включённом шифровании) */
export async function unlockJournal(passphrase) {
  const meta = readCryptMeta();
  if (!meta) return { ok: false, reason: 'Шифрование не включено' };
  const cm = await ensureCrypto();
  if (!(await cm.verifyPassphrase(passphrase, meta.salt, meta.verifier))) {
    return { ok: false, reason: 'Неверный пароль' };
  }
  const { key } = await cm.setupEncryption(passphrase, meta.salt);
  cipher = key;
  const recs = loadJournalRaw();
  const out = [];
  for (const r of recs) {
    if (r.enc) {
      const text = await cm.decryptString(r.enc, key);
      out.push({ ...r, text: text ?? '', enc: undefined });
    } else {
      out.push(r);
    }
  }
  memRecords = out; // диск не трогаем — там остаётся шифрованное
  return { ok: true, count: out.length };
}

/** Шифрование включено (на диске есть мета) */
export function isJournalEncrypted() {
  return !!readCryptMeta();
}

/** Записи доступны (не включено или разблокировано в этой сессии) */
export function isJournalUnlocked() {
  return !isJournalEncrypted() || !!cipher;
}
