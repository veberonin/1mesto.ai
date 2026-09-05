// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// SSR-дым: десктоп-ветка (мок window.flowDesktop ДО импорта модулей).
// Запуск: npm run test:ui (vitest). В node --test не участвует.
import { describe, it, expect, beforeAll } from 'vitest';

const calls = { asrCheck: 0, getSettings: 0 };

beforeAll(() => {
  // мок preload-моста: desktop.js читает window.flowDesktop при импорте модуля
  globalThis.window = globalThis.window || {};
  globalThis.window.flowDesktop = {
    platform: 'win32',
    getSettings: async () => {
      calls.getSettings += 1;
      return { provider: 'none', language: 'ru', mode: 'clean', dictText: '1с = 1С' };
    },
    saveSettings: async () => ({}),
    insertText: async () => ({ method: 'paste' }),
    aiFormat: async () => ({ formattedText: 'x', source: 'local' }),
    hidePill: async () => ({}),
    onCommand: () => {},
    transcribe: async () => ({ text: 'тест', source: 'whisper' }),
    downloadModel: async () => ({ ok: true, path: 'C:\\m.bin' }),
    asrCheck: async () => {
      calls.asrCheck += 1;
      return {
        platform: 'win32', whisperBin: true, whisperModel: true,
        modelDownloaded: true, modelPath: 'C:\\models\\ggml-base-q5_1.bin', geminiKey: false,
      };
    },
  };
});

describe('SSR (десктоп): экраны с flowDesktop рендерятся без краша', () => {
  it('SettingsTab показывает ASR-карточку и словарь', async () => {
    const React = (await import('react')).default;
    const { renderToString } = await import('react-dom/server');
    const { default: SettingsTab } = await import('../components/SettingsTab.jsx');

    const html = renderToString(
      <SettingsTab
        settings={{
          provider: 'none', apiKey: '', autoFormat: true, autoCopy: false, soundOn: true,
          name: '', privacy: false, autoPunct: true, normalizeNumbers: true,
          whisperBin: 'C:\\whisper\\main.exe', whisperModel: '',
          dictText: '', macrosText: '', onboarded: true,
        }}
        onChange={() => {}}
        serverOnline
        onCheckServer={() => {}}
        onResetStats={() => {}}
        onToast={() => {}}
      />
    );
    expect(html).toContain('Распознавание речи');
    expect(html).toContain('whisper-cli');
    expect(html).toContain('Словарь и макросы');
    expect(html).toContain('Импорт из файла');
  });

  it('PillWindow рендерит пилюлю', async () => {
    const React = (await import('react')).default;
    const { renderToString } = await import('react-dom/server');
    const { default: PillWindow } = await import('../components/PillWindow.jsx');
    const html = renderToString(<PillWindow />);
    expect(html).toContain('Flow');
  });

  it('DictationTab (десктоп-настройки)', async () => {
    const React = (await import('react')).default;
    const { renderToString } = await import('react-dom/server');
    const { default: DictationTab } = await import('../components/DictationTab.jsx');
    const html = renderToString(
      <DictationTab
        recording={false}
        language="ru"
        mode="clean"
        transcript=""
        onTranscriptChange={() => {}}
        interim=""
        formatted=""
        formatMeta={null}
        processing={false}
        elapsed={0}
        liveWpm={0}
        onToggleRecording={() => {}}
        onClear={() => {}}
        onAiFormat={() => {}}
        onCopy={() => {}}
        onModeChange={() => {}}
        settings={{ name: '', dictText: '', macrosText: '', privacy: false }}
        stats={{}}
        refreshKey={0}
        onToast={() => {}}
      />
    );
    expect(html).toContain('вернись в поток');
  });
});
