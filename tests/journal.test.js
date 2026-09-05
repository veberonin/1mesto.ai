import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Мини-шим localStorage: журнал должен работать и в браузере, и в тестах (AB-06)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const j = await import('../src/lib/journal.js');

beforeEach(() => {
  store.clear();
});

test('M-01/M-02: каждая реплика в истории с полями схемы', () => {
  const rec = j.addUtterance({ text: 'привет жюри', words: 2, wpm: 120, durSec: 1, app: 'zed', mode: 'clean', lang: 'ru' });
  assert.ok(rec.id.startsWith('u_'));
  assert.match(rec.ts, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/); // UTC ISO
  assert.equal(rec.app, 'zed');
  assert.equal(rec.v, 1);
  assert.equal(j.listUtterances().length, 1);
});

test('T-13: идентификаторы уникальны', () => {
  const a = j.addUtterance({ text: 'а', words: 1 });
  const b = j.addUtterance({ text: 'б', words: 1 });
  assert.notEqual(a.id, b.id);
});

test('P-12/T-10: приватный режим не пишет текст', () => {
  const rec = j.addUtterance({ text: 'секрет', words: 1, privacy: true });
  assert.equal(rec.text, '');
  assert.equal(rec.words, 1, 'метрики остаются');
});

test('M-04: поиск подстрокой', () => {
  j.addUtterance({ text: 'кот Барсик спит', words: 3 });
  j.addUtterance({ text: 'собака Бобик бежит', words: 3 });
  const found = j.searchUtterances('барсик');
  assert.equal(found.length, 1);
  assert.ok(found[0].text.includes('Барсик'));
});

test('M-05: фильтр по приложению', () => {
  j.addUtterance({ text: 'один', words: 1, app: 'zed' });
  j.addUtterance({ text: 'два', words: 1, app: 'telegram' });
  const zed = j.filterUtterances({ app: 'zed' });
  assert.equal(zed.length, 1);
  assert.equal(zed[0].app, 'zed');
});

test('M-09/M-10: удаление записи и очистка', () => {
  const rec = j.addUtterance({ text: 'временная', words: 1 });
  j.deleteUtterance(rec.id);
  assert.equal(j.listUtterances().length, 0);
  j.addUtterance({ text: 'x', words: 1 });
  j.clearJournal();
  assert.equal(j.listUtterances().length, 0);
});

test('M-11/T-01: JSONL — одна реплика одна строка', () => {
  j.addUtterance({ text: 'строка с "кавычками"', words: 3 });
  j.addUtterance({ text: 'вторая', words: 1 });
  const jsonl = j.exportJSONL();
  const lines = jsonl.split('\n');
  assert.equal(lines.length, 2);
  const parsed = JSON.parse(lines[0]);
  assert.ok(parsed.id && parsed.ts);
});

test('AL-12/T-08: CSV с заголовком и полями wpm/слов', () => {
  j.addUtterance({ text: 'csv тест', words: 2, wpm: 100 });
  const csv = j.exportCSV();
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,ts,app,words,wpm,durSec,mode,lang,source');
  assert.ok(lines[1].includes('"2","100"'));
});

test('T-03..T-06: сводка считает день, слова, приложения', () => {
  j.addUtterance({ text: 'привет', words: 5, wpm: 150, app: 'zed' });
  j.addUtterance({ text: 'ещё', words: 3, wpm: 100, app: 'zed' });
  const s = j.journalSummary();
  assert.equal(s.total, 2);
  assert.equal(s.todayCount, 2);
  assert.equal(s.todayWords, 8);
  assert.equal(s.byApp.zed, 2);
  assert.equal(s.aiShare, 0); // S-02: все локальные
});

test('M-14: ротация — не больше 10000 записей', () => {
  // наполняем хранилище напрямую — проверяем логику ротации, а не скорость цикла
  const many = Array.from({ length: 10010 }, (_, i) => ({
    id: `u_${i}`, v: 1, ts: new Date().toISOString(), app: 't', text: `r${i}`,
    words: 1, wpm: 0, durSec: 0, mode: 'clean', lang: 'ru', source: 'local',
    latencies: {}, pasteMethod: null, dictHits: [], fillersRemoved: 0,
  }));
  store.set('flow-journal-v1', JSON.stringify(many));
  j.addUtterance({ text: 'свежая', words: 1 });
  const list = j.listUtterances();
  assert.ok(list.length <= 10000, `ротация не сработала: ${list.length}`);
  assert.equal(list[list.length - 1].text, 'свежая', 'свежая запись остаётся');
});
