// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// AO: точные структуры из речи — версии, адрес:порт, формулы, величины
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const { formatText } = await import('../src/lib/formatter.js');
const t = (x) => formatText(x, { mode: 'clean', lang: 'ru' }).text;

describe('AO: точные структуры (токен-сканер)', () => {
  it('AO-04: версия словами → цифры с суффиксом', () => {
    assert.match(t('обновись до три точка два точка один бета два'), /3\.2\.1-бета|3\.2\.1-beta2/);
    assert.match(t('версия ноль точка девять точка ноль вышла'), /0\.9\.0/);
  });

  it('AO-06: адрес сервера с портом', () => {
    assert.match(
      t('сервер сто двадцать семь точка ноль точка ноль точка один двоеточие пять тысяч работает'),
      /127\.0\.0\.1:5000/
    );
  });

  it('AO-09: формулы, включая цепочки', () => {
    assert.match(t('посчитай пять умножить на три минус два'), /5 \* 3 - 2/);
    assert.match(t('десять плюс пять'), /10 \+ 5/);
  });

  it('AO-11: величины с единицами', () => {
    assert.match(t('задержка двести миллисекунд'), /200\s+мс/);
    assert.match(t('частота сорок четыре килогерца'), /44\s+кГц/);
    assert.match(t('файл десять мегабайт'), /10\s+МБ/);
  });

  it('регресс: деньги, время, даты, обычная речь не тронуты', () => {
    assert.match(t('зарплата пять тысяч рублей'), /5000/);
    assert.match(t('звонок в три часа дня'), /15:00/);
    assert.match(t('пятое марта'), /5 марта/);
    assert.equal(t('привет как дела').includes('как'), true);
  });
});

describe('C-04/починка URL модели', () => {
  it('C-04: обрыв микрофона во время записи доходит до пользователя', async () => {
    const { readFileSync } = await import('node:fs');
    const rec = readFileSync(new URL('../src/lib/recorder.js', import.meta.url), 'utf8');
    assert.match(rec, /onDeviceLost/);
    const pill = readFileSync(new URL('../src/components/PillWindow.jsx', import.meta.url), 'utf8');
    assert.match(pill, /Микрофон отключился/);
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /Микрофон отключился/);
  });

  it('A-08: URL модели ведёт на открытый орг (ggml-org стал gated)', async () => {
    const { readFileSync } = await import('node:fs');
    const mj = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.match(mj, /huggingface\.co\/ggerganov\/whisper\.cpp/);
    assert.doesNotMatch(mj, /huggingface\.co\/ggml-org/); // gated-репо не должен остаться URL модели
  });
});
