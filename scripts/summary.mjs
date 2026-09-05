#!/usr/bin/env node
/**
 * Сводка прогона одной командой (T-15): npm run summary
 * Читает серверную базу (server/data/db.json) или дергает живой API.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'server', 'data', 'db.json');

async function main() {
  let summary = null;

  try {
    const res = await fetch('http://localhost:5000/api/summary', { signal: AbortSignal.timeout(1500) });
    if (res.ok) summary = await res.json();
  } catch {
    /* сервер не запущен — читаем файл */
  }

  if (!summary) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const day = new Date().toISOString().slice(0, 10);
      const today = db.sessions.filter((x) => (x.timestamp || '').startsWith(day));
      summary = {
        totalSessions: db.sessions.length,
        todaySessions: today.length,
        todayWords: today.reduce((a, x) => a + (x.wordCount || 0), 0),
        totalWords: db.sessions.reduce((a, x) => a + (x.wordCount || 0), 0),
        byMode: db.sessions.reduce((m, x) => ((m[x.mode] = (m[x.mode] || 0) + 1), m), {}),
      };
    } catch {
      console.error('Нет ни живого сервера, ни базы. Запусти npm run dev или продиктуй что-нибудь.');
      process.exit(1); // Y-04: ненулевой код возврата при ошибке
    }
  }

  console.log('══════════ 1mesto Flow · сводка прогона ══════════');
  console.log(`Сессий всего:      ${summary.totalSessions}`);
  console.log(`Сессий сегодня:    ${summary.todaySessions}`);
  console.log(`Слов сегодня:      ${summary.todayWords}`);
  console.log(`Слов всего:        ${summary.totalWords}`);
  if (summary.medianWpm !== undefined) console.log(`Медиана WPM:       ${summary.medianWpm}`);
  if (summary.byMode) console.log(`По режимам:        ${JSON.stringify(summary.byMode)}`);
  process.exit(0); // Y-03: код 0 при успехе
}

main();
