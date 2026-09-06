// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// Живой экзамен офлайн-пути: whisper-cli + ggml-модель → текст → форматтер.
// Опциональный: требует WHISPER_BIN, WHISPER_MODEL, WHISPER_SAMPLE (env);
// без них — skip (AB-06: обычные тесты не зависят от микрофона и модели).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';

const bin = process.env.WHISPER_BIN;
const model = process.env.WHISPER_MODEL;
const sample = process.env.WHISPER_SAMPLE;
const ready = bin && model && sample && existsSync(bin) && existsSync(model) && existsSync(sample);

describe('whisper live (офлайн-путь, опциональный)', () => {
  it('аудио → whisper-cli → текст → форматтер даёт чистую вставку', { skip: !ready }, async () => {
    const raw = await new Promise((resolve, reject) => {
      execFile(bin, ['-m', model, '-nt', sample], { timeout: 300000 }, (e, stdout) =>
        e
          ? reject(e)
          : resolve(
              String(stdout || '')
                .split('\n')
                .filter(Boolean)
                .join(' ')
                .trim()
            )
      );
    });
    assert.ok(raw.length > 10, 'пустой транскрипт');
    const { sanitizeTranscript } = await import('../src/lib/asr-guard.js');
    const { formatText } = await import('../src/lib/formatter.js');
    const clean = sanitizeTranscript(raw);
    const out = formatText(clean.text, { mode: 'clean', lang: 'en' });
    assert.ok(out.text.length > 10);
    assert.ok(!out.text.includes('  '));
  });
});
