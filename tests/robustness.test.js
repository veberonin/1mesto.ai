// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// O-группа: устойчивость к мусорному вводу — API не должен бросать ни на чём
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatText } from '../src/lib/formatter.js';
import { sanitizeTranscript } from '../src/lib/asr-guard.js';
import { parseHotkey } from '../src/lib/hotkey.js';

const JUNK = [
  '',
  '   ',
  '\n\n\n',
  ' ',
  '\b',
  '\x7f',
  '🎉🚀💯',
  'книга',
  'كتابة عربية',
  '中文测试',
  'a'.repeat(100000),
  '???!!!',
  '...точки',
  '— — —',
  'CTRL+ALT+DELETE',
  'Alt+Ctrl+ё',
  null,
  undefined,
  42,
  {},
  [],
  NaN,
];

describe('O: мусорный ввод не роняет приложение', () => {
  it('formatText выживает любой мусор и возвращает строку', () => {
    for (const junk of JUNK) {
      const out = formatText(/** @type {any} */ (junk), { mode: 'clean', lang: 'ru' });
      assert.equal(typeof out.text, 'string', `junk=${JSON.stringify(junk)?.slice(0, 20)}`);
      assert.ok(typeof out.meta.words === 'number');
    }
  });

  it('formatText выживает мусорные opts (dict:null, macros:мусор)', () => {
    assert.doesNotThrow(() => formatText('привет', { dict: null, macros: null }));
    assert.doesNotThrow(() => formatText('привет', { dict: { '': 'x', y: 42 }, macros: 'string' }));
    assert.doesNotThrow(() => formatText('привет', { mode: 123, lang: {} }));
  });

  it('sanitizeTranscript выживает любой мусор', () => {
    for (const junk of JUNK) {
      const r = sanitizeTranscript(/** @type {any} */ (junk));
      assert.equal(typeof r.text, 'string');
      assert.equal(typeof r.hallucinated, 'boolean');
    }
    // пустое/бесполезное → не «распознано», а честная пустота
    assert.equal(sanitizeTranscript('[музыка]').text, '');
    assert.equal(sanitizeTranscript('').text, '');
  });

  it('parseHotkey выживает мусор и возвращает null/валидный объект', () => {
    for (const junk of [null, undefined, '', '   ', 42, {}, 'Alt+', '+Ctrl', 'Ctrl+Alt+Shift+Meta+X+Y+Z']) {
      const r = parseHotkey(/** @type {any} */ (junk));
      assert.ok(r === null || typeof r === 'object', `junk=${String(junk)}`);
    }
  });

  it('инъекции: разметка остаётся обычным текстом, UI её экранирует (нет dangerouslySetInnerHTML)', async () => {
    const evil = '<script>alert(1)</script>';
    const out = formatText(evil, { mode: 'clean', lang: 'ru' });
    assert.equal(typeof out.text, 'string'); // не бросает, не исполняет
    // статический гарвард: в рендере нет сырого HTML — React экранирует по умолчанию
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const walk = (dir) => {
      for (const f of readdirSync(dir)) {
        const p = `${dir}/${f}`;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.jsx?$/.test(f)) {
          const src = readFileSync(p, 'utf8');
          assert.ok(!/dangerouslySetInnerHTML/.test(src), `сырой HTML в ${p}`);
        }
      }
    };
    walk(new URL('../src', import.meta.url).pathname);
  });
});
