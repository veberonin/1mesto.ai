import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../server/index.js';

let server;
let base;

before(() => {
  server = app.listen(0); // случайный свободный порт
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

test('GET /api/health — сервер живой', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.storage, 'json');
  assert.ok(typeof data.sessions === 'number');
});

test('POST /api/stats сохраняет сессию', async () => {
  const session = {
    durationSeconds: 42,
    wordCount: 123,
    averageWpm: 176,
    maxWpm: 190,
    language: 'ru',
    mode: 'email',
  };
  const res = await fetch(`${base}/api/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);

  const list = await (await fetch(`${base}/api/stats`)).json();
  assert.ok(list.totalSessions >= 1);
  assert.ok(list.totalWords >= 123);
  assert.ok(list.recentSessions.some((s) => s.wordCount === 123 && s.averageWpm === 176));
});

test('GET /api/stats возвращает агрегаты', async () => {
  const data = await (await fetch(`${base}/api/stats`)).json();
  assert.ok(typeof data.totalWords === 'number');
  assert.ok(typeof data.totalSessions === 'number');
  assert.ok(typeof data.maxWpmRecord === 'number');
  assert.ok(typeof data.avgSessionWpm === 'number');
  assert.ok(Array.isArray(data.recentSessions));
});

test('POST /api/format без ключей — локальный умный форматер', async () => {
  const res = await fetch(`${base}/api/format`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'эм ну привет точка как дела вопросительный знак',
      mode: 'clean',
      language: 'ru',
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.source, 'local');
  assert.equal(data.formattedText, 'Привет. Как дела?');
});

test('POST /api/format умеет email-режим', async () => {
  const data = await (
    await fetch(`${base}/api/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'отправь отчёт', mode: 'email', language: 'ru', name: 'Тест' }),
    })
  ).json();
  assert.ok(data.formattedText.startsWith('Добрый день!'));
  assert.ok(data.formattedText.includes('С уважением,\nТест'));
});

test('POST /api/format с пустым текстом', async () => {
  const data = await (
    await fetch(`${base}/api/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ', mode: 'clean', language: 'ru' }),
    })
  ).json();
  assert.equal(data.formattedText, '');
});

test('SPA fallback не ломает 404 для API', async () => {
  const res = await fetch(`${base}/api/unknown`);
  assert.equal(res.status, 404);
});
