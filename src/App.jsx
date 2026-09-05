import React, { useState, useEffect, useRef, useCallback } from 'react';

import Aurora from './components/Aurora.jsx';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import DictationPill from './components/DictationPill.jsx';
import DictationTab from './components/DictationTab.jsx';
import AnalyticsTab from './components/AnalyticsTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import AboutTab from './components/AboutTab.jsx';
import Toasts from './components/Toasts.jsx';

import { isSpeechSupported, SpeechEngine } from './lib/speech.js';
import { startMicMeter } from './lib/audio.js';
import { sound } from './lib/sound.js';
import { formatText, countWordsIn, DEMO_SAMPLES } from './lib/formatter.js';
import { loadStats, saveSession, getToday, resetStats } from './lib/stats.js';

const SETTINGS_KEY = 'flow-settings-v1';

const DEFAULT_SETTINGS = {
  provider: 'none', // none | gemini | openai
  apiKey: '',
  autoFormat: true,
  autoCopy: false,
  soundOn: true,
  name: '',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* iframe без allow-same-origin кидает SecurityError — молча работаем в памяти */
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  // ---------- навигация / базовые состояния ----------
  const [tab, setTab] = useState('dictation');
  const [language, setLanguage] = useState('ru');
  const [mode, setMode] = useState('clean');
  const [settings, setSettings] = useState(loadSettings);
  const [serverOnline, setServerOnline] = useState(false);
  const [toasts, setToasts] = useState([]);

  // ---------- диктовка ----------
  const [recording, setRecording] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [micDenied, setMicDenied] = useState(null); // null | 'denied' | 'unsupported'
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

  // ---------- refs (против stale closures) ----------
  const transcriptRef = useRef('');
  const formattedRef = useRef('');
  const recordingRef = useRef(false);
  const startRef = useRef(0);
  const wordsRef = useRef(0);
  const peakRef = useRef(0);
  const timerRef = useRef(null);
  const engineRef = useRef(null);
  const meterRef = useRef(null);
  const demoRef = useRef(null);
  const toastId = useRef(0);
  const langRef = useRef(language);
  langRef.current = language;

  // ---------- тосты ----------
  const toast = useCallback((msg, type = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ---------- persist настроек + звук ----------
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* noop */ }
    sound.enabled = settings.soundOn;
  }, [settings]);

  // ---------- живой локальный формат ----------
  useEffect(() => {
    if (!settings.autoFormat) return;
    if (!transcript.trim()) {
      setFormatted('');
      setFormatMeta(null);
      return;
    }
    const { text, meta } = formatText(transcript, { mode, lang: language, name: settings.name });
    formattedRef.current = text;
    setFormatted(text);
    setFormatMeta((prev) => ({ ...meta, source: prev?.source === 'ai' ? 'ai' : 'local' }));
  }, [transcript, mode, language, settings.autoFormat, settings.name]);

  // ---------- health-check сервера ----------
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
    const iv = setInterval(checkServer, 30000);
    return () => clearInterval(iv);
  }, [checkServer]);

  useEffect(() => {
    if (!isSpeechSupported()) setMicDenied('unsupported');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- таймер сессии ----------
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

  // ---------- текст ----------
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

  // ---------- завершение сессии (общее для микрофона и демо) ----------
  const finishSession = () => {
    const durSec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    const words = wordsRef.current;
    const wpm = durSec >= 3 ? Math.round(words / (durSec / 60)) : 0;
    stopTimer();
    setRecording(false);
    recordingRef.current = false;
    setBars([]);
    setInterim('');

    if (words >= 1) {
      const s = saveSession({
        words,
        wpm,
        peakWpm: peakRef.current,
        durSec,
        mode,
        lang: langRef.current,
      });
      setStats({ ...s });
      toast(`${words} слов за ${durSec} c · ${wpm} wpm`, 'success');

      if (settings.autoCopy) copyText(formattedRef.current || transcriptRef.current, true);
      if (settings.provider !== 'none' && settings.apiKey) aiPolish();
    } else {
      toast('Ничего не расслышал — попробуй ещё раз', 'error');
    }
    setLiveWpm(0);
    setElapsed(0);
  };

  // ---------- реальная запись ----------
  const startRecording = async () => {
    stopDemo(true);
    if (!isSpeechSupported()) {
      setMicDenied('unsupported');
      toast('Web Speech API доступен в Chrome/Edge — попробуй демо', 'error');
      return;
    }

    sound.start();
    startRef.current = Date.now();
    wordsRef.current = countWordsIn(transcriptRef.current);
    peakRef.current = 0;
    setPeakWpm(0);
    setElapsed(0);
    setLiveWpm(0);
    setRecording(true);
    recordingRef.current = true;
    startTimer();

    // Живая волна (не блокируем запись, если камеры/микрофона нет)
    startMicMeter(({ bars: b }) => setBars(b))
      .then((meter) => {
        meterRef.current = meter;
      })
      .catch(() => {
        meterRef.current = null; // пилюля перейдёт на CSS-анимацию
      });

    engineRef.current = new SpeechEngine({
      onFinal: (piece) => {
        appendTranscript(piece);
      },
      onInterim: (text) => setInterim(text),
      onError: (code) => {
        if (code === 'denied') {
          setMicDenied('denied');
          sound.error();
          toast('Доступ к микрофону запрещён — открой превью в новой вкладке', 'error');
          abortRecording();
        } else if (code === 'network') {
          toast('Speech API: нет сети. Демо-режим всё равно работает', 'error');
        } else if (code === 'no-mic') {
          setMicDenied('denied');
          sound.error();
          abortRecording();
        }
      },
    });
    const ok = engineRef.current.start(langRef.current === 'ru' ? 'ru-RU' : 'en-US');
    if (!ok) {
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

  /** тихая отмена при ошибках — без сохранения сессии */
  const abortRecording = () => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    if (meterRef.current) {
      meterRef.current.stop();
      meterRef.current = null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, formatted, mode]);

  // ---------- демо-режим (полный пайплайн без микрофона) ----------
  const stopDemo = (silent = false) => {
    if (demoRef.current) {
      clearInterval(demoRef.current);
      demoRef.current = null;
    }
    if (!silent) setDemoActive(false);
  };

  const runDemo = (lang) => {
    if (recordingRef.current) abortRecording();
    stopDemo(true);

    if (lang !== language) setLanguage(lang);
    langRef.current = lang;

    replaceTranscript('');
    setFormatted('');
    formattedRef.current = '';
    setFormatMeta(null);
    sound.start();

    const words = DEMO_SAMPLES[lang].split(/\s+/);
    let i = 0;
    let acc = '';
    const smooth = [0.2, 0.5, 0.3, 0.7, 0.4, 0.6, 0.25];

    startRef.current = Date.now();
    wordsRef.current = 0;
    peakRef.current = 0;
    setPeakWpm(0);
    setElapsed(0);
    setDemoActive(true);
    startTimer();

    demoRef.current = setInterval(() => {
      const step = Math.random() < 0.35 ? 2 : 1;
      for (let k = 0; k < step && i < words.length; k++) {
        acc += (acc ? ' ' : '') + words[i++];
      }
      if (Math.random() < 0.25) sound.tick();

      // псевдо-волна
      for (let b = 0; b < smooth.length; b++) {
        smooth[b] = Math.min(1, Math.max(0.08, smooth[b] + (Math.random() - 0.5) * 0.75));
      }
      setBars([...smooth]);

      replaceTranscript(acc);
      setInterim(words[i] || '');

      if (i >= words.length) {
        clearInterval(demoRef.current);
        demoRef.current = null;
        setDemoActive(false);
        sound.success();
        finishSession();
      }
    }, 160);
  };

  // ---------- AI-полировка на сервере ----------
  const aiPolish = async () => {
    if (!transcriptRef.current.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': settings.provider,
          'x-api-key': settings.apiKey,
        },
        body: JSON.stringify({ text: transcriptRef.current, mode, language }),
      });
      const data = await res.json();
      if (data && data.formattedText) {
        formattedRef.current = data.formattedText;
        setFormatted(data.formattedText);
        setFormatMeta((m) => ({ ...(m || { removedFillers: 0 }), source: 'ai' }));
        sound.success();
        toast('AI отполировал текст ✨', 'success');
      } else {
        throw new Error(data.error || 'empty');
      }
    } catch {
      toast('AI недоступен — оставил локальный результат', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // ---------- буфер обмена ----------
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
    if (!silent) toast(ok ? 'Скопировано в буфер ✓' : 'Браузер не дал доступ к буферу', ok ? 'success' : 'error');
  };

  // ---------- прочие экшены ----------
  const handleClear = () => {
    abortRecording();
    stopDemo(true);
    setDemoActive(false);
    replaceTranscript('');
    setFormatted('');
    formattedRef.current = '';
    setFormatMeta(null);
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

  // ---------- горячие клавиши ----------
  const toggleRef = useRef(toggleRecording);
  toggleRef.current = toggleRecording;

  useEffect(() => {
    const handler = (e) => {
      if ((e.altKey || e.ctrlKey) && e.code === 'Space') {
        e.preventDefault();
        toggleRef.current();
      }
      if (e.code === 'Escape' && (recordingRef.current || demoRef.current)) {
        abortRecording();
        stopDemo();
        setLiveWpm(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---------- размонтирование ----------
  useEffect(() => () => {
    if (engineRef.current) engineRef.current.stop();
    if (meterRef.current) meterRef.current.stop();
    stopTimer();
    stopDemo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pillState = recording || demoActive ? 'recording' : processing ? 'processing' : 'idle';
  const today = getToday(stats);

  return (
    <div className="min-h-screen relative">
      <Aurora />
      <DictationPill
        state={pillState}
        bars={bars}
        elapsed={elapsed}
        liveWpm={liveWpm}
        language={language}
        interim={interim}
        onToggle={toggleRecording}
      />

      <div className="relative z-10">
        <Header
          tab={tab}
          setTab={setTab}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          serverOnline={serverOnline}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          {tab === 'dictation' && (
            <>
              <Hero />
              <div className="mt-10">
                <DictationTab
                  recording={recording}
                  demoActive={demoActive}
                  micDenied={micDenied}
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
                  peakWpm={peakWpm}
                  onToggleRecording={toggleRecording}
                  onDemo={runDemo}
                  onModeChange={setMode}
                  onClear={handleClear}
                  onAiFormat={aiPolish}
                  onCopy={copyText}
                  aiEnabled={settings.provider !== 'none' && !!settings.apiKey}
                  stats={{ ...stats, today }}
                />
              </div>
            </>
          )}

          {tab === 'analytics' && (
            <div className="pt-8">
              <AnalyticsTab
                stats={stats}
                serverOnline={serverOnline}
                onRefresh={() => {
                  setStats(loadStats());
                  checkServer();
                  toast('Статистика обновлена', 'info');
                }}
                onReset={() => {
                  setStats(resetStats());
                  toast('Статистика сброшена', 'info');
                }}
              />
            </div>
          )}

          {tab === 'settings' && (
            <div className="pt-8">
              <SettingsTab
                settings={settings}
                onChange={setSettings}
                serverOnline={serverOnline}
                onCheckServer={() => {
                  checkServer();
                  toast(serverOnline ? 'Сервер на связи ✓' : 'Проверяю… если бэкенд запущен — статус станет зелёным', serverOnline ? 'success' : 'info');
                }}
                onResetStats={() => {
                  setStats(resetStats());
                  toast('Статистика сброшена', 'info');
                }}
              />
            </div>
          )}

          {tab === 'about' && (
            <div className="pt-8">
              <AboutTab />
            </div>
          )}
        </main>

        <footer className="border-t border-white/[0.05] py-6 text-center text-[11.5px] text-zinc-600">
          Сделано с ❤️ на хакатоне · 1mesto Flow — клон Wispr Flow · голосом по клавиатуре
        </footer>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}
