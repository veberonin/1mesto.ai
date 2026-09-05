// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPasteCommand } from '../electron/paste.js';

test('macOS: osascript + Cmd+V', () => {
  const c = pickPasteCommand('darwin');
  assert.equal(c.cmd, 'osascript');
  assert.ok(c.args.join(' ').includes('keystroke "v" using command down'));
  assert.ok(c.timeoutMs > 0);
});

test('Windows: powershell SendKeys ^v', () => {
  const c = pickPasteCommand('win32');
  assert.equal(c.cmd, 'powershell.exe');
  assert.ok(c.args.includes("(New-Object -ComObject WScript.Shell).SendKeys('^v')"));
});

test('Linux: xdotool ctrl+v', () => {
  const c = pickPasteCommand('linux');
  assert.equal(c.cmd, 'xdotool');
  assert.deepEqual(c.args, ['key', '--clearmodifiers', 'ctrl+v']);
});

test('неизвестная платформа: без команды (только буфер)', () => {
  const c = pickPasteCommand('freebsd');
  assert.equal(c.cmd, null);
  assert.deepEqual(c.args, []);
});

test('paste.js не импортирует Electron (тестируемость)', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../electron/paste.js', import.meta.url), 'utf8')
  );
  assert.ok(!src.includes("require('electron") && !src.includes("from 'electron'"));
});
