// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTranscript, isPureHallucination } from '../src/lib/asr-guard.js';

describe('F-22/F-23: guard от галлюцинаций распознавателя', () => {
  it('известные галлюцинации на тишине срезаются', () => {
    const r = sanitizeTranscript('Субтитры делал DimaTorzok');
    assert.equal(r.text, '');
    assert.equal(r.hallucinated, true);
    assert.ok(isPureHallucination('Продолжение следует...'));
    assert.ok(isPureHallucination('Спасибо за просмотр!'));
  });

  it('речь вокруг галлюцинации сохраняется', () => {
    const r = sanitizeTranscript('Встреча в три часа. Субтитры делал DimaTorzok');
    assert.match(r.text, /Встреча в три часа/);
    assert.equal(r.hallucinated, true);
    assert.equal(isPureHallucination('Встреча в три часа'), false);
  });

  it('чистая речь проходит как есть', () => {
    const r = sanitizeTranscript('Привет, как дела?');
    assert.equal(r.text, 'Привет, как дела?');
    assert.equal(r.hallucinated, false);
  });

  it('мусор из одной буквы/пунктуации → пусто', () => {
    const r = sanitizeTranscript('а . ,');
    assert.equal(r.text, '');
    assert.equal(r.hallucinated, true);
  });

  it('пустой вход → пусто без исключений', () => {
    assert.deepEqual(sanitizeTranscript(''), { text: '', hallucinated: true });
    assert.deepEqual(sanitizeTranscript(null), { text: '', hallucinated: true });
  });
});
