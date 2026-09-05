// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportProfile, importProfile } from '../src/lib/profile.js';
import { voiceCheckAvailable, speakText, stopSpeaking } from '../src/lib/voicecheck.js';

describe('B-15/B-06/V-07: профиль настроек экспорт/импорт + санитизация', () => {
  it('экспорт переносит конфигурацию и НЕ переносит API-ключи', () => {
    const json = exportProfile({
      provider: 'gemini',
      apiKey: 'СЕКРЕТ',
      geminiKey: 'СЕКРЕТ2',
      name: 'Иван',
      hotkey: 'Ctrl+Q',
      privacy: true,
      aiTimeoutMs: 30000,
    });
    const parsed = JSON.parse(json);
    assert.equal(parsed.name, 'Иван');
    assert.equal(parsed.hotkey, 'Ctrl+Q');
    assert.equal(parsed.privacy, true);
    assert.equal(parsed.aiTimeoutMs, 30000);
    assert.ok(!json.includes('СЕКРЕТ'), 'ключи не должны попадать в профиль');
  });

  it('импорт принимает только известные ключи-примитивы', () => {
    const { values, errors } = importProfile('{"hotkey":"F9","evil":{"x":1},"aiTimeoutMs":"20000"}');
    assert.equal(values.hotkey, 'F9');
    assert.equal(values.evil, undefined);
    assert.equal(values.aiTimeoutMs, 20000);
    assert.equal(errors.length, 0);
  });

  it('битый JSON даёт понятную ошибку, не бросает (B-06)', () => {
    const { values, errors } = importProfile('{oops');
    assert.deepEqual(values, {});
    assert.equal(errors.length, 1);
    assert.match(errors[0], /не JSON/);
  });

  it('__proto__ в файле настроек не загрязняет объект (V-07)', () => {
    const { values } = importProfile('{"__proto__":{"polluted":true},"name":"ок"}');
    assert.equal(values.name, 'ок');
    assert.equal({}.polluted, undefined);
    assert.ok(!Object.hasOwn(values, '__proto__'), '__proto__ не должен быть собственным ключом');
  });

  it('roundtrip: экспорт → импорт возвращает те же значения', () => {
    const src = { provider: 'ollama', mode: 'email', restoreYo: true, dictText: '1с = 1С' };
    const { values } = importProfile(exportProfile(src));
    assert.equal(values.provider, 'ollama');
    assert.equal(values.mode, 'email');
    assert.equal(values.restoreYo, true);
    assert.equal(values.dictText, '1с = 1С');
  });
});

describe('AK: «Проверка вслух» не ломает сценарий без speechSynthesis', () => {
  it('в node-окружении фича недоступна, но безопасна', () => {
    assert.equal(voiceCheckAvailable(), false);
    assert.equal(speakText('привет'), false);
    assert.equal(speakText(''), false);
    assert.doesNotThrow(() => stopSpeaking());
  });
});
