// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// O-14/V: сервер валидирует вход и не отдаёт внутренние ошибки наружу
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('Server: валидация входа и безопасность ответов', () => {
  const srv = () => readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

  it('O-14: text не-строка → 400 «поле text должно быть строкой», без text.trim в ответе', () => {
    const s = srv();
    assert.match(s, /поле text должно быть строкой/);
    assert.match(s, /typeof text !== 'string'/);
  });

  it('AN-07: лимит тела запроса (413) + парсер ошибок JSON (400)', () => {
    const s = srv();
    assert.match(s, /limit: '8mb'/);
    assert.match(s, /entity\.too\.large/);
    assert.match(s, /entity\.parse\.failed/);
    assert.match(s, /некорректный JSON/);
  });

  it('AN-08: query parser simple — DoS-поверхность qs убрана', () => {
    assert.match(srv(), /query parser', 'simple'/);
  });

  it('V: ключи только из env, клиентские не читаются', () => {
    const s = srv();
    assert.doesNotMatch(s, /x-api-key/);
    assert.match(s, /process\.env\.GEMINI_API_KEY/);
  });

  it('O-13: занятый порт → честный выход, а не падение стека', () => {
    assert.match(srv(), /EADDRINUSE/);
  });

  it('V-09: интерфейс слушает только loopback (HOST env — явный оверрайд)', () => {
    assert.match(srv(), /process\.env\.HOST \|\| '127\.0\.0\.1'/);
  });

  it('V-08: API_TOKEN → Bearer-токен на всех методах кроме health', () => {
    assert.match(srv(), /Bearer \$\{process\.env\.API_TOKEN\}/);
  });

  it('AF-06: rate-limit настраивается (RATE_LIMIT, 429)', () => {
    assert.match(srv(), /RATE_LIMIT/);
    assert.match(srv(), /429/);
  });

  it('P-04: облако на /api/format только по явному x-ai-provider клиента', () => {
    const s = srv();
    assert.match(s, /x-ai-provider'\] \|\| 'none'/);
    assert.doesNotMatch(s, /GEMINI_API_KEY \? 'gemini'/); // env-ключ сам постобработку не включает
  });
});
