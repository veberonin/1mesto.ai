// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import Sidebar from './components/Sidebar.jsx';
import DictationPill from './components/DictationPill.jsx';
import DictationTab from './components/DictationTab.jsx';
import HistoryTab from './components/HistoryTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import AboutTab from './components/AboutTab.jsx';
import ScratchpadTab from './components/ScratchpadTab.jsx';
import Onboarding from './components/Onboarding.jsx';
import Toasts from './components/Toasts.jsx';

import { isSpeechSupported, SpeechEngine } from './lib/speech.js';
import { startMicMeter } from './lib/audio.js';
import { WavCapture } from './lib/recorder.js';
import { sound } from './lib/sound.js';
import { formatText, countWordsIn } from './lib/formatter.js';
import { parsePairsText } from './lib/dictio.js';
import { hotkeyMatches, DEFAULT_HOTKEY } from './lib/hotkey.js';
import { speakText, stopSpeaking } from './lib/voicecheck.js';
import { loadStats, saveSession, getToday, resetStats } from './lib/stats.js';
import { addUtterance } from './lib/journal.js';
import { isDesktop, desktopAPI } from './lib/desktop.js';

const SETTINGS_KEY = 'flow-settings-v1';

const DEFAULT_SETTINGS = {
  provider: 'none',
  apiKey: '',
  autoFormat: true,
  autoCopy: false,
  soundOn: true,
  name: '',
  privacy: false,
  autoPunct: true,
  normalizeNumbers: true,
  whisperBin: '',
  whisperModel: '',
  dictText: '',
  macrosText: '',
  language: 'ru',
  voiceCommands: true,
  restoreYo: false,
  voiceCheck: false,
  hotkeyStyle: 'Ctrl+Alt+S',
  aiTimeoutMs: 25000,
  onboarded: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [tab, setTab] = useState('dictation');
  const [language, setLanguage] = useState('ru');
  const [mode, setMode] = useState('clean');
  const [settings, setSettings] = useState(loadSettings);
  const [serverOnline, setServerOnline] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [recording, setRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [formatted, setFormatted] = useState('');
  const [formatMeta, setFormatMeta] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [peakWpm, setPeakWpm] = useState(0);
  const [bars, setBars] = useState([]);
  const [stats, setStats] = useState(loadStats);
  const [journalTick, setJournalTick] = useState(0);

  const transcriptRef = useRef('');
  const formattedRef = useRef('');
  const recordingRef = useRef(false);
  const startRef = useRef(0);
  const wordsRef = useRef(0);
  const peakRef = useRef(0);
  const timerRef = useRef(null);
  const engineRef = useRef(null);
  const meterRef = useRef(null);
  const captureRef = useRef(null); // WAV-фолбэк для десктопа
  const engineDeadRef = useRef(false);
  const toastId = useRef(0);
  const lastToastRef = useRef({ msg: '', t: 0 });
  const langRef = useRef(language);
  langRef.current = language;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const formatMetaRef = useRef(null);
  formatMetaRef.current = formatMeta;
  const pairs = useMemo(
    () => parsePairsText(`${settings.dictText || ''}\n${settings.macrosText || ''}`),
    [settings.dictText, settings.macrosText]
  );
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;

  // ---------- тосты (с дедупликацией — больше не спамят пачками) ----------
  const toast = useCallback((msg, type = 'info') => {
    const now = Date.now();
    if (lastToastRef.current.msg === msg && now - lastToastRef.current.t < 3000) return;
    lastToastRef.current = { msg, t: now };
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ---------- persist + звук + синк с десктопом ----------
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* noop */
    }
    sound.enabled = settings.soundOn;
    if (isDesktop()) {
      desktopAPI.saveSettings({ ...settings, language, mode }).catch(() => {});
    }
  }, [settings, language, mode]);

  // язык из настроек (auto/ru/en) — пилюля и дашборд синхронны
  useEffect(() => {
    const l = settings.language;
    if ((l === 'ru' || l === 'en' || l === 'auto') && l !== language) setLanguage(l);
  }, [settings.language]);

  useEffect(() => {
    try {
      localStorage.setItem('flow-language-v1', language);
    } catch {
      /* noop */
    }
  }, [language]);

  useEffect(() => {
    if (!isDesktop()) return;
    desktopAPI
      .getSettings()
      .then((s) => {
        if (!s) return;
        setSettings((prev) => ({ ...prev, ...s }));
        if (s.language === 'ru' || s.language === 'en') setLanguage(s.language);
        if (typeof s.mode === 'string') setMode(s.mode);
      })
      .catch(() => {});
  }, []);

  // ---------- живой формат ----------
  useEffect(() => {
    if (!settings.autoFormat) return;
    if (!transcript.trim()) {
      setFormatted('');
      setFormatMeta(null);
      return;
    }
    const { text, meta } = formatText(transcript, {
      mode,
      lang: language,
      name: settings.name,
      autoPunct: settings.autoPunct !== false,
      normalizeNumbers: settings.normalizeNumbers !== false,
      voiceCommands: settings.voiceCommands !== false,
      restoreYo: !!settings.restoreYo,
      dict: pairsRef.current.dict,
      macros: pairsRef.current.macros,
    });
    formattedRef.current = text;
    lastMetaRef.current = { ...meta, source: prevSourceRef.current };
    setFormatted(text);
    setFormatMeta(lastMetaRef.current);
  }, [
    transcript,
    mode,
    language,
    settings.autoFormat,
    settings.autoPunct,
    settings.normalizeNumbers,
    settings.name,
    settings.dictText,
    settings.macrosText,
    settings.voiceCommands,
    settings.restoreYo,
  ]);

  const lastMetaRef = useRef(null);
  const prevSourceRef = useRef('local');

  // ---------- health ----------
  const checkServer = useCallback(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    fetch('/api/health', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false))
      .finally(() => clearTimeout(t));
  }, []);
  useEffect(() => {
    checkServer();
    // P-04: в десктопе не поллим сервер — локальный режим не должен шуметь в сеть;
    // периодический health-check только в вебе и реже
    if (isDesktop()) return;
    const iv = setInterval(checkServer, 60000);
    return () => clearInterval(iv);
  }, [checkServer]);

  useEffect(() => {
    if (!isSpeechSupported() && !isDesktop()) setMicDenied('unsupported');
  }, []);

  // ---------- таймер ----------
  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startRef.current) / 1000;
      setElapsed(sec);
      const wpm = sec > 2.5 ? Math.round(wordsRef.current / (sec / 60)) : 0;
      setLiveWpm(wpm);
      if (wpm > peakRef.current) {
        peakRef.current = wpm;
        setPeakWpm(wpm);
      }
    }, 400);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const appendTranscript = (piece) => {
    const next = (transcriptRef.current ? transcriptRef.current + ' ' : '') + piece;
    transcriptRef.current = next;
    wordsRef.current = countWordsIn(next);
    setTranscript(next);
  };
  const replaceTranscript = (text) => {
    transcriptRef.current = text;
    wordsRef.current = countWordsIn(text);
    setTranscript(text);
  };

  // ---------- завершение сессии ----------
  const finishSession = async () => {
    // Десктоп-фолбэк: если браузерное распознавание не дало текст — локальный ASR по записи
    if (isDesktop() && !transcriptRef.current.trim() && captureRef.current) {
      try {
        toast('Распознаю локально…', 'info');
        const wav = captureRef.current.stop();
        captureRef.current = null;
        const res = await desktopAPI.transcribe(wav, langRef.current);
        if (res && res.text) {
          replaceTranscript(res.text);
          prevSourceRef.current = res.source === 'gemini' ? 'ai' : 'local';
          toast(`Распознано (${res.source}) ✓`, 'success');
        } else {
          toast(res?.hint || 'Распознаватель не настроен — см. Настройки', 'error');
        }
      } catch {
        toast('Не удалось распознать запись', 'error');
      }
    }
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }

    const durSec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    const words = wordsRef.current;
    const wpm = durSec >= 3 ? Math.round(words / (durSec / 60)) : 0;
    stopTimer();
    setRecording(false);
    recordingRef.current = false;
    setBars([]);
    setInterim('');

    if (words >= 1) {
      const finalText = formattedRef.current || transcriptRef.current;
      addUtterance({
        text: finalText,
        words,
        wpm,
        durSec,
        app: 'dashboard',
        mode,
        lang: langRef.current,
        source: formatMetaRef.current?.source === 'ai' ? 'ai' : 'local',
        latencies: {},
        dictHits: lastMetaRef.current?.dictHits || [],
        fillersRemoved: lastMetaRef.current?.removedFillers || 0,
        privacy: !!settingsRef.current.privacy,
      });
      setJournalTick((t) => t + 1);
      const s = saveSession({ words, wpm, peakWpm: peakRef.current, durSec, mode, lang: langRef.current });
      setStats({ ...s });
      toast(`${words} слов за ${durSec} c · ${wpm} wpm`, 'success');
      if (settings.autoCopy) copyText(formattedRef.current || transcriptRef.current, true);
      if (settings.voiceCheck) speakText(finalText, langRef.current === 'en' ? 'en' : 'ru'); // AK
      if (settings.provider !== 'none' && settings.apiKey) aiPolish();
    } else if (!transcriptRef.current.trim()) {
      toast('Ничего не расслышал — попробуй ещё раз', 'error');
    }
    setLiveWpm(0);
    setElapsed(0);
  };

  // ---------- запись ----------
  const startRecording = async () => {
    if (!isSpeechSupported() && !isDesktop()) {
      setMicDenied('unsupported');
      toast('Распознавание доступно в Chrome/Edge — или скачай приложение', 'error');
      return;
    }

    sound.start();
    startRef.current = Date.now();
    wordsRef.current = countWordsIn(transcriptRef.current);
    peakRef.current = 0;
    engineDeadRef.current = false;
    prevSourceRef.current = 'local';
    setPeakWpm(0);
    setElapsed(0);
    setLiveWpm(0);
    setRecording(true);
    recordingRef.current = true;
    startTimer();

    // Волна
    startMicMeter(({ bars: b }) => setBars(b))
      .then((m) => {
        meterRef.current = m;
      })
      .catch(() => {});

    // Десктоп: параллельно пишем WAV для локального распознавания
    if (isDesktop()) {
      try {
        captureRef.current = new WavCapture();
        await captureRef.current.start(() => {});
      } catch {
        captureRef.current = null;
      }
    }

    engineRef.current = new SpeechEngine({
      onFinal: (piece) => appendTranscript(piece),
      onInterim: (text) => setInterim(text),
      onError: (code) => {
        if (code === 'denied') {
          setMicDenied('denied');
          sound.error();
          toast('Доступ к микрофону запрещён', 'error');
          abortRecording();
        } else if (code === 'network' || code === 'service-not-allowed' || code === 'not-allowed') {
          // В Electron Web Speech без ключа не работает — не страшно: пишем WAV → локальный ASR
          engineDeadRef.current = true;
          setInterim('');
          if (isDesktop()) {
            toast('Браузерное распознавание недоступно — пишу аудио для локального распознавания', 'info');
          } else {
            toast('Speech API: нет сети — проверь интернет', 'error');
            abortRecording();
          }
        } else if (code === 'no-mic') {
          setMicDenied('denied');
          sound.error();
          abortRecording();
        }
      },
    });
    const ok = engineRef.current.start(langRef.current === 'en' ? 'en-US' : 'ru-RU'); // auto → ru-RU (веб)
    if (!ok && !isDesktop()) {
      abortRecording();
      toast('Не удалось запустить распознавание', 'error');
    }
  };

  const stopRecording = () => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    if (meterRef.current) {
      meterRef.current.stop();
      meterRef.current = null;
    }
    sound.stop();
    finishSession();
  };

  const abortRecording = () => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    if (meterRef.current) {
      meterRef.current.stop();
      meterRef.current = null;
    }
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
    stopTimer();
    recordingRef.current = false;
    setRecording(false);
    setBars([]);
    setInterim('');
    setLiveWpm(0);
  };

  const toggleRecording = useCallback(() => {
    if (recordingRef.current) stopRecording();
    else startRecording();
  }, [settings, mode]);

  // ---------- AI ----------
  const aiPolish = async () => {
    if (!transcriptRef.current.trim()) return;
    setProcessing(true);
    try {
      let data;
      if (isDesktop()) {
        data = await desktopAPI.aiFormat({
          text: transcriptRef.current,
          mode,
          language,
          provider: settings.provider,
          apiKey: settings.apiKey,
          name: settings.name,
          dict: pairsRef.current.dict,
          macros: pairsRef.current.macros,
          voiceCommands: settings.voiceCommands !== false,
          restoreYo: !!settings.restoreYo,
        });
        if (!data || !data.formattedText) throw new Error('empty');
      } else {
        const res = await fetch('/api/format', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ai-provider': settings.provider,
            'x-api-key': settings.apiKey,
          },
          body: JSON.stringify({
            text: transcriptRef.current,
            mode,
            language,
            dict: pairsRef.current.dict,
            macros: pairsRef.current.macros,
            voiceCommands: settings.voiceCommands !== false,
            restoreYo: !!settings.restoreYo,
          }),
        });
        data = await res.json();
      }
      if (data && data.formattedText) {
        formattedRef.current = data.formattedText;
        setFormatted(data.formattedText);
        setFormatMeta((m) => ({
          ...(m || { removedFillers: 0 }),
          source: data.source === 'ai' ? 'ai' : 'local',
        }));
        prevSourceRef.current = data.source === 'ai' ? 'ai' : 'local';
        sound.success();
        toast('Текст отполирован ✨', 'success');
      } else {
        throw new Error(data.error || 'empty');
      }
    } catch {
      toast('AI недоступен — оставил локальный результат', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // ---------- буфер ----------
  const copyText = async (text, silent = false) => {
    if (!text) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (!silent)
      toast(ok ? 'Скопировано в буфер ✓' : 'Браузер не дал доступ к буферу', ok ? 'success' : 'error');
  };

  // ---------- экшены ----------
  const handleClear = () => {
    abortRecording();
    replaceTranscript('');
    setFormatted('');
    formattedRef.current = '';
    setFormatMeta(null);
    lastMetaRef.current = null;
    setElapsed(0);
    setLiveWpm(0);
  };

  const handleToggleLanguage = () => {
    if (recordingRef.current) {
      abortRecording();
      toast('Запись остановлена: язык переключён', 'info');
    }
    setLanguage((l) => (l === 'ru' ? 'en' : 'ru'));
  };

  // ---------- хоткеи ----------
  const toggleRef = useRef(toggleRecording);
  toggleRef.current = toggleRecording;
  useEffect(() => {
    const handler = (e) => {
      if (hotkeyMatches(e, settingsRef.current.hotkey || DEFAULT_HOTKEY)) {
        if (isDesktop()) return;
        e.preventDefault();
        toggleRef.current();
      }
      if (e.code === 'Escape' && recordingRef.current) {
        abortRecording();
        setLiveWpm(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(
    () => () => {
      stopSpeaking(); // AK
      if (engineRef.current) engineRef.current.stop();
      if (meterRef.current) meterRef.current.stop();
      if (captureRef.current) captureRef.current.stop();
      stopTimer();
    },
    []
  );

  const pillState = recording ? 'recording' : processing ? 'processing' : 'idle';
  const today = getToday(stats);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Sidebar tab={tab} setTab={setTab} hotkey={settings.hotkey} />

      <DictationPill
        state={pillState}
        bars={bars}
        elapsed={elapsed}
        liveWpm={liveWpm}
        language={language}
        interim={interim}
        onToggle={toggleRecording}
        hotkey={settings.hotkey}
      />

      <div className="md:pl-60">
        <main className="max-w-6xl mx-auto px-4 sm:px-8 pb-16 pt-6 md:pt-10">
          {tab === 'dictation' && (
            <DictationTab
              recording={recording}
              language={language}
              mode={mode}
              transcript={transcript}
              onTranscriptChange={replaceTranscript}
              interim={interim}
              formatted={formatted}
              formatMeta={formatMeta}
              processing={processing}
              elapsed={elapsed}
              liveWpm={liveWpm}
              onToggleRecording={toggleRecording}
              onModeChange={setMode}
              onClear={handleClear}
              onAiFormat={aiPolish}
              onCopy={copyText}
              settings={settings}
              stats={{ ...stats, today }}
              refreshKey={journalTick}
              onToast={toast}
            />
          )}

          {tab === 'scratchpad' && (
            <div className="pt-2">
              <ScratchpadTab lastResult={formatted} onToast={toast} />
            </div>
          )}

          {tab === 'history' && (
            <div className="pt-2">
              <HistoryTab privacy={settings.privacy} onToast={toast} />
            </div>
          )}

          {tab === 'settings' && (
            <div className="pt-2">
              <SettingsTab
                settings={settings}
                onChange={setSettings}
                serverOnline={serverOnline}
                onCheckServer={() => {
                  checkServer();
                  toast(serverOnline ? 'Сервер на связи ✓' : 'Проверяю…', serverOnline ? 'success' : 'info');
                }}
                onResetStats={() => {
                  setStats(resetStats());
                  toast('Статистика сброшена', 'info');
                }}
                onResetSettings={() => {
                  setSettings({ ...DEFAULT_SETTINGS, onboarded: true });
                  toast('Настройки сброшены к значениям по умолчанию', 'success');
                }}
                onToast={toast}
              />
            </div>
          )}

          {tab === 'about' && (
            <div className="pt-2">
              <AboutTab />
            </div>
          )}
        </main>
      </div>

      {!settings.onboarded && (
        <Onboarding
          hotkey={settings.hotkey}
          onDone={() => {
            setSettings((s) => ({ ...s, onboarded: true }));
          }}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
