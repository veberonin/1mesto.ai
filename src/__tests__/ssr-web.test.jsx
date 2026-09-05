// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// SSR-дым: каждый экран рендерится без краша в веб-режиме (без window.flowDesktop).
// Запуск: npm run test:ui (vitest). В node --test не участвует.
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

import Sidebar from '../components/Sidebar.jsx';
import DictationTab from '../components/DictationTab.jsx';
import SettingsTab from '../components/SettingsTab.jsx';
import HistoryTab from '../components/HistoryTab.jsx';
import AboutTab from '../components/AboutTab.jsx';
import Onboarding from '../components/Onboarding.jsx';
import Toasts from '../components/Toasts.jsx';
import DictationPill from '../components/DictationPill.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const settings = {
  provider: 'gemini', apiKey: '', autoFormat: true, autoCopy: false, soundOn: true,
  name: 'Веберонин', privacy: false, autoPunct: true, normalizeNumbers: true,
  whisperBin: '', whisperModel: '', dictText: '1с = 1С', macrosText: '#адрес = Тверская 1',
  onboarded: true,
};

const noop = () => {};

describe('SSR (веб): все экраны рендерятся без краша', () => {
  it('Sidebar', () => {
    const html = renderToString(<Sidebar tab="dictation" setTab={noop} />);
    expect(html).toContain('Диктовка');
  });

  it('DictationTab', () => {
    const html = renderToString(
      <DictationTab
        recording={false}
        language="ru"
        mode="clean"
        transcript=""
        onTranscriptChange={noop}
        interim=""
        formatted=""
        formatMeta={null}
        processing={false}
        elapsed={0}
        liveWpm={0}
        onToggleRecording={noop}
        onClear={noop}
        onAiFormat={noop}
        onCopy={noop}
        onModeChange={noop}
        settings={settings}
        stats={{ todayWords: 0, today: { count: 0, words: 0 } }}
        refreshKey={0}
        onToast={noop}
      />
    );
    expect(html).toContain('вернись в поток');
  });

  it('DictationTab в записи', () => {
    const html = renderToString(
      <DictationTab
        recording
        language="ru"
        mode="email"
        transcript="привет эээ как дела"
        onTranscriptChange={noop}
        interim="запись"
        formatted="Привет, как дела?"
        formatMeta={{ removedFillers: 1 }}
        processing={false}
        elapsed={42}
        liveWpm={120}
        onToggleRecording={noop}
        onClear={noop}
        onAiFormat={noop}
        onCopy={noop}
        onModeChange={noop}
        settings={settings}
        stats={{ todayWords: 10, today: { count: 1, words: 10 } }}
        refreshKey={0}
        onToast={noop}
      />
    );
    expect(html).toContain('Слушаю');
  });

  it('SettingsTab — все секции, включая словарь/макросы и ASR (веб-ветка)', () => {
    const html = renderToString(
      <SettingsTab
        settings={settings}
        onChange={noop}
        serverOnline={false}
        onCheckServer={noop}
        onResetStats={noop}
        onToast={noop}
      />
    );
    expect(html).toContain('AI-полировка');
    expect(html).toContain('Словарь и макросы');
    expect(html).toContain('Импорт из файла');
    expect(html).toContain('Поведение');
  });

  it('HistoryTab / AboutTab / Onboarding / Toasts / DictationPill / ErrorBoundary', () => {
    expect(renderToString(<HistoryTab privacy={false} onToast={noop} />)).toBeTruthy();
    expect(renderToString(<AboutTab />)).toBeTruthy();
    expect(renderToString(<Onboarding onDone={noop} />)).toContain('ШАГ');
    expect(renderToString(<Toasts toasts={[{ id: 1, msg: 'тест', type: 'info' }]} />)).toContain('тест');
    expect(
      renderToString(
        <DictationPill
          state="idle"
          bars={[]}
          elapsed={0}
          liveWpm={0}
          language="ru"
          interim=""
          onToggle={noop}
          disabled={false}
        />
      )
    ).toBeTruthy();
    expect(renderToString(<ErrorBoundary><div>ок</div></ErrorBoundary>)).toContain('ок');
  });
});
