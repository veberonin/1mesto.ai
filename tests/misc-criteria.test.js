// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// заглушка localStorage (в браузере — нативный, в node — карта в памяти)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { addUtterance, clearJournal, journalSummary } = await import('../src/lib/journal.js');

describe('T: статистика и журнал — явные признаки', () => {
  it('T-04: счётчик слов за день присутствует в сводке', () => {
    clearJournal();
    addUtterance({
      text: 'два слова тут',
      words: 3,
      wpm: 90,
      durSec: 2,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const s = journalSummary();
    assert.ok(typeof s.todayWords === 'number' && s.todayWords >= 3, `todayWords=${s.todayWords}`);
    assert.ok(typeof s.todayCount === 'number');
  });

  it('T-06: распределение по приложениям', () => {
    clearJournal();
    addUtterance({
      text: 'a',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'pill',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    addUtterance({
      text: 'b',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'pill',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const s = journalSummary();
    assert.ok(s.byApp && s.byApp.pill >= 2, JSON.stringify(s.byApp));
  });

  it('T-10/P-12: приватный режим не пишет текст реплики', () => {
    clearJournal();
    const r = addUtterance({
      text: 'секретная фраза',
      privacy: true,
      words: 2,
      wpm: 60,
      durSec: 2,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    assert.equal(r.text, '');
    assert.equal(journalSummary().records ?? '', '');
  });

  it('T-13: идентификаторы реплик уникальны', () => {
    clearJournal();
    const a = addUtterance({
      text: 'первая',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const b = addUtterance({
      text: 'вторая',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    assert.notEqual(a.id, b.id);
  });
});
