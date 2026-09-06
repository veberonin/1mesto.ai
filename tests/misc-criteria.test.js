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
const { formatText } = await import('../src/lib/formatter.js');

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

describe('F-11/F-12: даты и время из речи', () => {
  const t = (s) => formatText(s, { mode: 'clean', lang: 'ru' }).text;

  it('F-11: «пятое марта» → «5 марта»', () => {
    assert.match(t('встретимся пятое марта в парке'), /5 марта/);
    assert.match(t('дедлайн двадцать пятое декабря'), /25 декабря/);
  });

  it('F-12: «три часа дня» → «15:00», «девять утра» → «09:00»', () => {
    assert.match(t('звонок в три часа дня'), /15:00/);
    assert.match(t('созвон в девять утра завтра'), /09:00/);
    assert.match(t('ужин в семь вечера'), /19:00/);
    assert.match(t('встреча в полдень'), /12:00/);
  });

  it('F-10 не сломан: числа и деньги', () => {
    assert.match(t('зарплата пять тысяч'), /5000/);
  });
});
