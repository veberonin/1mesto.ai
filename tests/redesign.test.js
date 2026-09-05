// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(process.cwd(), 'src');
const read = (p) => readFileSync(join(srcRoot, p), 'utf8');

describe('redesign: светлая система как в оригинале', () => {
  it('tailwind.config.js: палитра paper/ink/accent задана', () => {
    const cfg = readFileSync(join(process.cwd(), 'tailwind.config.js'), 'utf8');
    assert.match(cfg, /#F5F2EB/); // paper
    assert.match(cfg, /#DD5B0A/); // accent
    assert.match(cfg, /ink/);
  });

  it('в App/Dictation/Sidebar/Pill не осталось тёмно-градиентных классов', () => {
    for (const f of ['App.jsx', 'components/DictationTab.jsx', 'components/Sidebar.jsx', 'components/DictationPill.jsx']) {
      const s = read(f);
      assert.doesNotMatch(s, /from-brand-(orange|flame|violet|rose)/, `${f}: градиентный бренд-класс`);
      assert.doesNotMatch(s, /bg-slate-9|bg-\[#0/, `${f}: тёмный фон`);
    }
  });

  it('пилюля — чёрная с белыми барами (как в оригинале)', () => {
    const pill = read('components/DictationPill.jsx');
    assert.match(pill, /ink-950/);
    assert.match(pill, /bg-white/);
    assert.doesNotMatch(pill, /from-brand-/);
  });

  it('приветствие с оранжевыми кейкапами — есть', () => {
    const d = read('components/DictationTab.jsx');
    assert.match(d, /keycap/);
    assert.match(d, /вернись в поток/);
  });

  it('лента «Сегодня» и правый рельс подключены', () => {
    const d = read('components/DictationTab.jsx');
    assert.match(d, /TodayList/);
    assert.match(d, /StatRail/);
  });

  it('recorder: WavCapture доступен для десктоп-фолбэка', () => {
    const rec = read('lib/recorder.js');
    assert.match(rec, /class WavCapture/);
    assert.match(rec, /export/);
  });

  it('App: WAV-фолбэк и дедуп тостов на месте', () => {
    const app = read('App.jsx');
    assert.match(app, /WavCapture/);
    assert.match(app, /desktopAPI\.transcribe/);
    assert.match(app, /lastToastRef/);
  });

  it('Settings: секция «Распознавание» с кнопкой скачать модель', () => {
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /AsrCard/);
    assert.match(st, /downloadModel/);
    assert.match(st, /whisperBin/);
  });

  it('Sidebar: 4 вкладки + карточка скачивания', () => {
    const sb = read('components/Sidebar.jsx');
    for (const word of ['Диктовка', 'История', 'Настройки', 'О проекте', 'Скачать']) {
      assert.match(sb, new RegExp(word));
    }
  });

  it('демо-режимы полностью выпилены из UI', () => {
    for (const f of ['App.jsx', 'components/DictationTab.jsx']) {
      const s = read(f);
      assert.doesNotMatch(s, /[Дд]емо|runDemo|onDemo|DEMO_SAMPLES/, `${f}: остались следы демо`);
    }
  });

  it('пилюля десктопа: WAV-фолбэк и режим ?pill=1', () => {
    const pill = read('components/PillWindow.jsx');
    assert.match(pill, /WavCapture/);
    assert.match(pill, /desktopAPI\.transcribe/);
    assert.match(pill, /transcriptRef/);
    const app = read('App.jsx');
    assert.match(app, /pill=1/);
    assert.match(app, /PillWindow/);
  });

  it('Onboarding: 3 шага и флаг onboarded', () => {
    const ob = read('components/Onboarding.jsx');
    assert.match(ob, /ШАГ/);
    assert.match(ob, /getUserMedia/);
    assert.match(ob, /onboarded|onDone/);
  });
});
