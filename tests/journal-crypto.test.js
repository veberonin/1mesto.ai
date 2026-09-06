// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// M-17: шифрование журнала по настройке — AES-GCM на диске, ключ только в памяти
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.sessionStorage = { setItem: () => {}, getItem: () => null, removeItem: () => {} };

const J = await import('../src/lib/journal.js');
const C = await import('../src/lib/crypto.js');

describe('crypto.js: AES-GCM + PBKDF2', () => {
  it('roundtrip и неверный ключ', async () => {
    const { key, salt } = await C.setupEncryption('фраза-правильная');
    const box = await C.encryptString('секрет', key);
    assert.equal(await C.decryptString(box, key), 'секрет');
    const wrong = await C.setupEncryption('фраза-другая', salt);
    assert.equal(await C.decryptString(box, wrong.key), null);
  });

  it('верификатор отличает верную фразу, не храня её', async () => {
    const { salt, verifier } = await C.setupEncryption('пароль-123');
    assert.ok(await C.verifyPassphrase('пароль-123', salt, verifier));
    assert.ok(!(await C.verifyPassphrase('не-пароль', salt, verifier)));
  });

  it('битые данные → null, не бросает', async () => {
    const { key } = await C.setupEncryption('x1234');
    assert.equal(await C.decryptString({ iv: '!!!', data: '???' }, key), null);
  });
});

describe('M-17: журнал шифруется по настройке', () => {
  it('включение: на диске шифровано, в памяти — открытый текст', async () => {
    store.delete('flow-journal-v1');
    J.clearJournal();
    J.addUtterance({
      text: 'открытая реплика до шифрования',
      words: 4,
      wpm: 100,
      durSec: 2,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const r = await J.enableJournalEncryption('супер-пароль');
    assert.ok(r.ok, r.reason);
    // на диске: текст пуст, enc есть
    const disk = JSON.parse(store.get('flow-journal-v1'));
    assert.equal(disk[disk.length - 1].text, '');
    assert.ok(disk[disk.length - 1].enc.data.length > 10);
    assert.ok(!disk[disk.length - 1].text);
    // в памяти (разблокированная сессия): текст виден
    const mem = J.loadJournal();
    assert.equal(mem[mem.length - 1].text, 'открытая реплика до шифрования');
    // новая запись тоже шифруется на диск
    J.addUtterance({
      text: 'после включения',
      words: 2,
      wpm: 90,
      durSec: 1,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const disk2 = JSON.parse(store.get('flow-journal-v1'));
    assert.equal(disk2[disk2.length - 1].text, '');
    assert.ok(disk2[disk2.length - 1].enc);
    assert.ok(J.isJournalEncrypted() && J.isJournalUnlocked());
  });

  it('неверный пароль не выключает шифрование', async () => {
    const r = await J.disableJournalEncryption('не-тот-пароль');
    assert.equal(r.ok, false);
    assert.ok(J.isJournalEncrypted());
  });

  it('выключение: всё расшифровано на диске, мета снята', async () => {
    const r = await J.disableJournalEncryption('супер-пароль');
    assert.ok(r.ok, r.reason);
    const disk = JSON.parse(store.get('flow-journal-v1'));
    assert.ok(disk.every((x) => !x.enc));
    assert.ok(disk.some((x) => x.text === 'после включения'));
    assert.ok(!J.isJournalEncrypted());
  });
});

describe('M-17: холодный старт — записи залочены до ввода фразы', () => {
  it('новая сессия видит шифрованные записи пустыми, unlock открывает', async () => {
    store.delete('flow-journal-v1');
    J.clearJournal();
    J.addUtterance({
      text: 'фраза под замком',
      words: 3,
      wpm: 100,
      durSec: 1,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    await J.enableJournalEncryption('ключ-дом');
    // «новая сессия»: чистая копия модуля (cache-bust) — cipher сброшен
    const J2 = await import('../src/lib/journal.js?fresh=1');
    assert.ok(J2.isJournalEncrypted());
    assert.ok(!J2.isJournalUnlocked());
    const locked = J2.loadJournal();
    const lockedRec = locked[locked.length - 1];
    assert.equal(lockedRec.text, ''); // текст недоступен
    assert.ok(lockedRec.enc);
    // summary-цифры живут и в замке
    const s = J2.journalSummary();
    assert.ok(s.total >= 1);
    // неверная фраза не открывает
    const bad = await J2.unlockJournal('не-тот');
    assert.equal(bad.ok, false);
    // верная — открывает
    const good = await J2.unlockJournal('ключ-дом');
    assert.ok(good.ok, good.reason);
    const open = J2.loadJournal();
    assert.equal(open[open.length - 1].text, 'фраза под замком');
    // диск по-прежнему шифрованный (ключ не хранится)
    const disk = JSON.parse(store.get('flow-journal-v1'));
    assert.equal(disk[disk.length - 1].text, '');
  });
});
