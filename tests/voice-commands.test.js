// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatText } from '../src/lib/formatter.js';

describe('K: голосовые команды пунктуации (RU)', () => {
  it('запятая / точка / тире / двоеточие', () => {
    const { text } = formatText('привет запятая коллеги точка тема тире отчёт двоеточие продажи', {});
    assert.ok(text.includes('Привет, коллеги.'), text);
    assert.ok(text.includes('—'), text);
    assert.ok(text.includes(':'), text);
  });

  it('новая строка и новый абзац дают разметку', () => {
    const { text } = formatText('первая с новой строки вторая с нового абзаца третья', {});
    assert.match(text, /\n/);
    assert.match(text, /\n\n/);
  });

  it('кавычки и многоточие', () => {
    const { text } = formatText('он сказал открыть кавычки привет закрыть кавычки и многоточие', {});
    assert.match(text, /«привет»/);
    assert.ok(text.includes('…'), text);
  });

  it('выключение флагом voiceCommands:false оставляет слова', () => {
    const { text } = formatText('раз запятая два', { voiceCommands: false });
    assert.doesNotMatch(text, /,/);
    assert.match(text, /запятая/);
  });
});

describe('K: голосовые команды пунктуации (EN)', () => {
  it('comma / period / colon', () => {
    const { text } = formatText('hello comma world period note colon done', { lang: 'en' });
    assert.ok(text.includes('Hello, world.'), text);
    assert.ok(/Note\s*:\s*Done|note\s*:\s*done/i.test(text), text);
  });

  it('new line / new paragraph', () => {
    const { text } = formatText('alpha comma beta new paragraph gamma', { lang: 'en' });
    assert.match(text, /Alpha, beta/);
    assert.match(text, /\n\n/);
  });
});

describe('Ё: восстановление буквы ё (restoreYo)', () => {
  it('е → ё в словах, где ё всегда', () => {
    const { text, meta } = formatText('еще объем трех черный зеленый надежный', { restoreYo: true });
    assert.match(text, /Ещё/);
    assert.match(text, /объём/);
    assert.match(text, /трёх/);
    assert.match(text, /чёрный/);
    assert.match(text, /зелёный/);
    assert.match(text, /надёжный/);
    assert.equal(meta.yoFixed, 6);
  });

  it('регистр сохраняется, по умолчанию выключено', () => {
    const on = formatText('Ещё раз и Елка', { restoreYo: true });
    assert.match(on.text, /Ёлка/);
    const off = formatText('еще объем', {});
    assert.doesNotMatch(off.text, /ё/);
    assert.equal(off.meta.yoFixed, 0);
  });

  it('не трогает английский', () => {
    const { meta } = formatText('volume three', { lang: 'en', restoreYo: true });
    assert.equal(meta.yoFixed, 0);
  });
});
