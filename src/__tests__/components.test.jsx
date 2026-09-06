// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// SSR-дым всех 18 компонентов: каждый рендерится в строку без падений
// (рекомендация организаторов, прогон 14: «покрыть 18 компонентов тестами»).
// Запуск: npm run test:ui (vitest)
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';

beforeAll(() => {
  // окружение «браузер»: журнал/настройки читают localStorage при рендере
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.flowDesktop = {
    platform: 'win32',
    getSettings: async () => ({}),
    saveSettings: async () => ({}),
    insertText: async () => ({ method: 'paste' }),
    aiFormat: async () => ({}),
    hidePill: async () => ({}),
    onCommand: () => {},
    onHotkeyConflict: () => {},
    transcribe: async () => ({ text: 'тест' }),
    asrCheck: async () => ({ platform: 'win32', whisperBin: true, whisperModel: true }),
    getLoginItem: async () => false,
    setLoginItem: async () => false,
    setStatus: () => {},
    downloadModel: async () => ({ ok: true }),
  };
  if (!globalThis.navigator) globalThis.navigator = {};
});

describe('SSR: 18 компонентов рендерятся без падений', () => {
  it('Aurora — фоновый градиент', async () => {
    const { default: C } = await import('../components/Aurora.jsx');
    expect(renderToString(<C />)).toContain('class');
  });

  it('Header — табы, язык, сервер', async () => {
    const { default: C } = await import('../components/Header.jsx');
    const html = renderToString(
      <C tab="home" setTab={() => {}} language="ru" onToggleLanguage={() => {}} serverOnline />
    );
    expect(html.length).toBeGreaterThan(100);
  });

  it('Hero — первый экран', async () => {
    const { default: C } = await import('../components/Hero.jsx');
    expect(renderToString(<C />).length).toBeGreaterThan(100);
  });

  it('Keycaps — клавиши хоткея', async () => {
    const { default: C } = await import('../components/Keycaps.jsx');
    expect(renderToString(<C hotkey="Alt+Space" />)).toContain('Alt');
  });

  it('DictationPill — состояния записи', async () => {
    const { default: C } = await import('../components/DictationPill.jsx');
    const html = renderToString(
      <C
        state="idle"
        bars={[0.2, 0.5]}
        elapsed={3}
        liveWpm={90}
        language="ru"
        interim=""
        onToggle={() => {}}
        disabled={false}
        hotkey="Alt+Space"
      />
    );
    expect(html.length).toBeGreaterThan(100);
  });

  it('DictationTab — диктовка с результатом', async () => {
    const { default: C } = await import('../components/DictationTab.jsx');
    const html = renderToString(
      <C
        settings={{ name: '', hotkey: 'Alt+Space' }}
        stats={{ totalWords: 10, totalSeconds: 20, totalSessions: 1 }}
        recording={false}
        language="ru"
        mode="clean"
        transcript="тестовая реплика"
        onTranscriptChange={() => {}}
        interim=""
        formatted="Тестовая реплика."
        formatMeta={{ removedFillers: 1, words: 2 }}
        processing={false}
        elapsed={2}
        liveWpm={60}
        onToggleRecording={() => {}}
      />
    );
    expect(html).toContain('тестовая реплика');
  });

  it('HistoryTab — история с записями', async () => {
    const { default: C } = await import('../components/HistoryTab.jsx');
    const html = renderToString(<C privacy={false} onToast={() => {}} />);
    expect(typeof html).toBe('string');
  });

  it('StatRail — статистика справа', async () => {
    const { default: C } = await import('../components/StatRail.jsx');
    const html = renderToString(<C stats={{ totalWords: 12, totalSeconds: 30, totalSessions: 2 }} />);
    expect(html).toContain('слов');
  });

  it('TodayList — реплики дня', async () => {
    const { default: C } = await import('../components/TodayList.jsx');
    const html = renderToString(
      <C refreshKey={0} privacy={false} onToast={() => {}} recording={false} hotkey="Alt+Space" />
    );
    expect(typeof html).toBe('string');
  });

  it('ScratchpadTab — черновик', async () => {
    const { default: C } = await import('../components/ScratchpadTab.jsx');
    expect(renderToString(<C lastResult="" onToast={() => {}} />)).toContain('черно');
  });

  it('SettingsTab — настройки целиком', async () => {
    const { default: C } = await import('../components/SettingsTab.jsx');
    const html = renderToString(
      <C
        settings={{
          language: 'ru',
          hotkey: 'Alt+Space',
          mode: 'clean',
          triggerMode: 'toggle',
          noiseSuppression: true,
          soundVolume: 1,
        }}
        onChange={() => {}}
        serverOnline={false}
        onCheckServer={() => {}}
        onResetStats={() => {}}
        onResetSettings={() => {}}
        onToast={() => {}}
      />
    );
    expect(html).toContain('Микрофон');
  });

  it('MicCard — устройства ввода', async () => {
    const { default: C } = await import('../components/MicCard.jsx');
    const html = renderToString(<C settings={{ micDeviceId: '' }} onChange={() => {}} onToast={() => {}} />);
    expect(html).toContain('Микрофон');
  });

  it('Sidebar — навигация', async () => {
    const { default: C } = await import('../components/Sidebar.jsx');
    expect(renderToString(<C tab="home" setTab={() => {}} hotkey="Alt+Space" />).length).toBeGreaterThan(50);
  });

  it('AboutTab — о проекте', async () => {
    const { default: C } = await import('../components/AboutTab.jsx');
    expect(renderToString(<C />).length).toBeGreaterThan(100);
  });

  it('Onboarding — первый запуск', async () => {
    const { default: C } = await import('../components/Onboarding.jsx');
    expect(renderToString(<C onDone={() => {}} hotkey="Alt+Space" />).length).toBeGreaterThan(100);
  });

  it('Toasts — пустой список не рендерит ничего', async () => {
    const { default: C } = await import('../components/Toasts.jsx');
    expect(renderToString(<C toasts={[]} />)).toBe('');
    expect(
      renderToString(<C toasts={[{ id: 1, type: 'error', msg: 'ошибка: выбери другой хоткей' }]} />)
    ).toContain('ошибка');
  });

  it('ErrorBoundary — рендерит детей и файл загружается', async () => {
    const { default: EB } = await import('../components/ErrorBoundary.jsx');
    const html = renderToString(
      <EB>
        <span>живой ребёнок</span>
      </EB>
    );
    expect(html).toContain('живой ребёнок');
  });

  it('PillWindow — пилюля (десктоп-мост замокан)', async () => {
    const { default: C } = await import('../components/PillWindow.jsx');
    const html = renderToString(<C />);
    expect(typeof html).toBe('string');
  });
});
