// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { test } from 'node:test';
import { execFile } from 'child_process';
import assert from 'node:assert/strict';
import path from 'path';

const CLI = path.resolve('scripts/flow-cli.mjs');
const run = (args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { timeout: 20000 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr });
    });
  });

test('Y-11: --version печатает версию, код 0', async () => {
  const r = await run(['--version']);
  assert.equal(r.code, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('Y-12: --help печатает справку с флагами', async () => {
  const r = await run(['--help']);
  assert.equal(r.code, 0);
  assert.ok(r.stdout.includes('--json'));
  assert.ok(r.stdout.includes('--batch'));
});

test('Y-04: неизвестный флаг — ненулевой код возврата', async () => {
  const r = await run(['--несуществующий']);
  assert.notEqual(r.code, 0);
  assert.ok(r.stderr.includes('ошибка'));
});

test('Y-01-пост/Y-02: --text --json выдаёт валидный JSON', async () => {
  const r = await run(['--text', 'эм ну привет точка как дела вопросительный знак', '--json']);
  assert.equal(r.code, 0);
  const data = JSON.parse(r.stdout);
  assert.equal(data.text, 'Привет. Как дела?');
  assert.equal(data.lang, 'ru');
});

test('Y-08: текст из stdin', async () => {
  const r = await new Promise((resolve) => {
    const p = execFile(process.execPath, [CLI, '--stdin'], (err, stdout) => resolve({ code: err ? 1 : 0, stdout }));
    p.stdin.write('купи хлеб запятая молоко');
    p.stdin.end();
  });
  assert.equal(r.code, 0);
  assert.ok(r.stdout.includes('хлеб, молоко'));
});

test('Y-10: --no-post отключает постобработку', async () => {
  const r = await run(['--text', 'эм ну как есть', '--no-post']);
  assert.equal(r.stdout.trim(), 'эм ну как есть');
});

test('Y-14: повтор команды даёт совпадающий текст', async () => {
  const a = await run(['--text', 'привет точка мир']);
  const b = await run(['--text', 'привет точка мир']);
  assert.equal(a.stdout, b.stdout);
});

test('Y-15: прогресс и ошибки идут в stderr, не в stdout', async () => {
  const r = await run(['--text', 'ok', '--json']);
  assert.equal(r.stderr, '');
});
