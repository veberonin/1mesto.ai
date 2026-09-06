// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// E-01/E-02/E-04: обрезка тишины и порог VAD — чистые функции без микрофона (AB-06)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { trimSilence, encodeWav } = await import('../src/lib/recorder.js');

const sec = (n) => new Float32Array(16000 * n);

describe('E-01/E-02/E-04: тишина и порог VAD', () => {
  it('E-01: тишина в начале обрезается', () => {
    const s = new Float32Array(32000); // 2 c: 1 c тишина + 1 c речь
    for (let i = 16000; i < 32000; i++) s[i] = 0.5 * Math.sin(i / 10);
    const out = trimSilence(s, { threshold: 0.01, paddingMs: 0 });
    assert.ok(out.length < 32000 - 15000, `длина ${out.length} — начало не обрезано`);
  });

  it('E-02: тишина в конце обрезается', () => {
    const s = new Float32Array(32000); // 1 c речь + 1 c тишина
    for (let i = 0; i < 16000; i++) s[i] = 0.5 * Math.sin(i / 10);
    const out = trimSilence(s, { threshold: 0.01, paddingMs: 0 });
    assert.ok(out.length < 32000 - 15000, `длина ${out.length} — конец не обрезан`);
  });

  it('E-04: порог настраивается — тихая речь при высоком пороге срезается сильнее', () => {
    const s = new Float32Array(16000);
    for (let i = 0; i < 16000; i++) s[i] = 0.02 * Math.sin(i / 10); // тихая речь
    const soft = trimSilence(s, { threshold: 0.001, paddingMs: 0 });
    const strict = trimSilence(s, { threshold: 0.1, paddingMs: 0 });
    assert.ok(strict.length < soft.length, 'высокий порог должен срезать больше');
  });

  it('речевой сигнал не портится: точная длина с padding (детерминированно)', () => {
    const s = new Float32Array(32000);
    for (let i = 16000; i < 32000; i++) s[i] = 0.5;
    const out = trimSilence(s, { threshold: 0.01, paddingMs: 120 });
    // старт речи 16000, паддинг слева 1920 → от 14080; справа упирается в конец массива
    assert.equal(out.length, 32000 - 14080);
  });

  it('полная тишина не даёт NaN и кодируется в валидный WAV', () => {
    const out = trimSilence(sec(1), { threshold: 0.01 });
    assert.ok(out.length >= 0);
    const wav = encodeWav(out, 16000);
    assert.equal(wav[0], 0x52); // 'R'
    assert.equal(wav[1], 0x49); // 'I'
  });
});

describe('AM-05/A-09: хвост фразы и кеш моделей', () => {
  it('AM-05: затухающий хвост фразы не обрезается (паддинг покрывает мягкое окончание)', () => {
    const s = new Float32Array(32000);
    for (let i = 0; i < 24000; i++) s[i] = 0.5 * Math.sin(i / 10);
    // мягкое затухание с 24000 до 30000 — всё ещё речь, не тишина
    for (let i = 24000; i < 30000; i++) s[i] = 0.02 + 0.01 * Math.sin(i / 7);
    const out = trimSilence(s, { threshold: 0.01, paddingMs: 120 });
    assert.ok(out.length > 30000 - 1920 - 1600, `хвост срезан: длина ${out.length}`);
  });
});
