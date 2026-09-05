// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Check, X } from 'lucide-react';
import { SpeechEngine } from '../lib/speech.js';
import { startMicMeter } from '../lib/audio.js';
import { sound } from '../lib/sound.js';
import { WavCapture } from '../lib/recorder.js';
import { formatText, countWordsIn } from '../lib/formatter.js';
import { isDesktop, desktopAPI } from '../lib/desktop.js';
import { saveSession } from '../lib/stats.js';

/**
 * Пилюля для десктоп-режима: живёт в отдельном прозрачном always-on-top окне.
 * Глобальный хоткей Alt+Space (main-процесс) показывает окно и стартует запись.
 * Остановка → форматирование → автоВСТАВКА в приложение, где стоял курсор.
 */
export default function PillWindow() {
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [inserted, setInserted] = useState(null); // 'paste' | 'clipboard-only'
  const [elapsed, setElapsed] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [interim, setInterim] = useState('');
  const [bars, setBars] = useState([]);
  const [error, setError] = useState('');

  const engineRef = useRef(null);
  const meterRef = useRef(null);
  const captureRef = useRef(null);
  const transcriptRef = useRef('');
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const wordsRef = useRef(0);
  const recordingRef = useRef(false);
  const doneRef = useRef(false);
  const settingsRef = useRef({ language: 'ru', mode: 'clean', name: '', provider: 'none', apiKey: '' });

  const stopMachines = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    if (meterRef.current) {
      meterRef.current.stop();
      meterRef.current = null;
    }
  };

  const finish = async (cancel = false) => {
    if (!recordingRef.current || doneRef.current) return;
    doneRef.current = true;
    recordingRef.current = false;
    stopMachines();
    setRecording(false);
    setInterim('');

    const hideSoon = (ms = 1100) => setTimeout(() => desktopAPI.hidePill(), ms);

    if (cancel) {
      if (captureRef.current) {
        captureRef.current.stop();
        captureRef.current = null;
      }
      hideSoon(50);
      return;
    }

    let raw = transcriptRef.current.trim();

    // Фолбэк: Speech API не дал текста → локальное распознавание по WAV-записи (whisper.cpp → Gemini)
    if (!raw && captureRef.current) {
      try {
        const wav = captureRef.current.stop();
        captureRef.current = null;
        const res = await desktopAPI.transcribe(wav, settingsRef.current.language === 'en' ? 'en' : 'ru');
        if (res && res.text) {
          transcriptRef.current = res.text;
          raw = res.text.trim();
        }
      } catch {
        /* ниже покажем ошибку */
      }
    }
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }

    if (!raw) {
      setError('Ничего не расслышал');
      sound.error();
      hideSoon(1200);
      return;
    }

    const s = settingsRef.current;
    const durSec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    const words = countWordsIn(raw);
    const wpm = durSec >= 3 ? Math.round(words / (durSec / 60)) : 0;

    const run = async () => {
      // формат: AI (если настроен) → локальный
      let text = formatText(raw, { mode: s.mode, lang: s.language, name: s.name }).text;
      try {
        if (s.provider && s.provider !== 'none') {
          const res = await desktopAPI.aiFormat({
            text: raw,
            mode: s.mode,
            language: s.language,
            provider: s.provider,
            apiKey: s.apiKey,
            name: s.name,
          });
          if (res && res.formattedText) text = res.formattedText;
        }
      } catch {
        // локальный результат уже готов
      }

      // вставка в активное приложение
      let method = 'clipboard-only';
      try {
        const r = await desktopAPI.insertText(text);
        method = r && r.method ? r.method : 'clipboard-only';
      } catch {
        // текст в буфере в любом случае
      }

      try {
        saveSession({ words, wpm, peakWpm: wpm, durSec, mode: s.mode, lang: s.language });
      } catch {
        // статистика не критична
      }

      sound.success();
      setInserted(method);
      setDone(true);
      hideSoon(1400);
    };
    run();
  };

  const start = async () => {
    if (!isDesktop()) {
      setError('Пилюля работает только в десктоп-приложении');
      return;
    }

    sound.start();
    startRef.current = Date.now();
    wordsRef.current = 0;
    recordingRef.current = true;
    setRecording(true);
    setDone(false);
    setInserted(null);
    setError('');

    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startRef.current) / 1000;
      setElapsed(sec);
      setLiveWpm(sec > 2.5 ? Math.round(wordsRef.current / (sec / 60)) : 0);
    }, 400);

    startMicMeter((levels) => setBars(levels.bars))
      .then((m) => {
        meterRef.current = m;
      })
      .catch(() => {});

    // Параллельно пишем WAV: если Speech API молчит — распознаем локально
    try {
      captureRef.current = new WavCapture();
      await captureRef.current.start(() => {});
    } catch {
      captureRef.current = null;
    }

    engineRef.current = new SpeechEngine({
      onFinal: (piece) => {
        transcriptRef.current = (transcriptRef.current ? transcriptRef.current + ' ' : '') + piece;
        wordsRef.current = countWordsIn(transcriptRef.current);
      },
      onInterim: (t) => setInterim(t),
      onError: (code) => {
        if (code === 'denied') setError('Доступ к микрофону запрещён системой');
        else if (code === 'network') setInterim(''); // текст даст локальный ASR по записи
        else if (code === 'no-mic') setError('Микрофон не найден');
        if (code === 'denied' || code === 'no-mic') {
          sound.error();
          recordingRef.current = false;
          stopMachines();
          setRecording(false);
        }
      },
    });
    engineRef.current.start(settingsRef.current.language === 'en' ? 'en-US' : 'ru-RU');
  };

  // init: настройки из main → автостарт (окно показывается только для диктовки)
  useEffect(() => {
    let disposed = false;

    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.className = '';

    desktopAPI
      .getSettings()
      .then((s) => {
        if (disposed || !s) return;
        settingsRef.current = Object.assign({}, settingsRef.current, s);
      })
      .catch(() => {})
      .finally(() => {
        if (!disposed) setTimeout(start, 180); // даём окну появиться
      });

    desktopAPI.onCommand((cmd) => {
      if (cmd === 'stop') finish(false);
      if (cmd === 'cancel') finish(true);
    });

    const esc = (e) => {
      if (e.code === 'Escape') finish(true);
    };
    window.addEventListener('keydown', esc);

    return () => {
      disposed = true;
      window.removeEventListener('keydown', esc);
      stopMachines();
      if (captureRef.current) {
        captureRef.current.stop();
        captureRef.current = null;
      }
      document.documentElement.style.background = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = Math.floor(elapsed / 60);
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
  const s = settingsRef.current;

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-8" style={{ WebkitAppRegion: 'drag' }}>
      <div className="flex flex-col items-center">
        <div
          className={
            'flex items-center gap-3 h-[56px] px-2 pr-5 rounded-full border backdrop-blur-xl transition-all ' +
            (done
              ? 'bg-emerald-950/80 border-emerald-500/40'
              : recording
                ? 'bg-ink-950/95 border-white/25 shadow-pill'
                : 'bg-ink-950/95 border-white/10')
          }
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <span
            className={
              'ml-1.5 w-10 h-10 rounded-full flex items-center justify-center ' +
              (done
                ? 'bg-emerald-500/90'
                : recording
                  ? 'bg-white/10'
                  : 'bg-white')
            }
          >
            {done ? (
              <Check className="w-5 h-5 text-white" />
            ) : recording ? (
              <span className="w-3.5 h-3.5 bg-white rounded-[4px]" />
            ) : (
              <Mic className="w-5 h-5 text-ink-950 !text-ink-950" style={{ color: '#121110' }} />
            )}
          </span>

          {recording && !done && (
            <span className="flex items-end gap-[3px] h-6 w-[80px] justify-center">
              {(bars.length ? bars : [0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.35]).map((v, i) => (
                <span
                  key={i}
                  className="w-[3.5px] rounded-full bg-white"
                  style={{ height: Math.max(12, v * 100) + '%', transition: 'height 90ms linear' }}
                />
              ))}
            </span>
          )}

          {done && (
            <span className="text-[13px] font-bold text-emerald-300 px-1">
              {inserted === 'paste' ? 'Вставлено ✓' : 'В буфере обмена ✓'}
            </span>
          )}

          {!recording && !done && (
            <span className="text-[13px] font-semibold text-white/90 px-1">{error || 'Flow'}</span>
          )}

          {recording && !done && (
            <span className="flex items-center gap-2 text-[11px] font-semibold tabular-nums">
              <span className="text-white/90">
                {mm}:{ss}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-accent-soft">{liveWpm} wpm</span>
            </span>
          )}

          {recording && !done && (
            <button
              onClick={() => finish(true)}
              title="Отменить (Esc)"
              className="ml-1 w-7 h-7 rounded-full bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.08] flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/70" />
            </button>
          )}
        </div>

        {recording && !done && (interim || error) && (
          <div
            className={
              'mt-2.5 max-w-[420px] px-4 py-1.5 rounded-full bg-ink-950/95 border backdrop-blur-xl text-[12.5px] ' +
              (error
                ? 'border-amber-500/40 text-amber-300 font-semibold'
                : 'border-white/[0.07] text-white/70 italic caret')
            }
          >
            {error || interim}
          </div>
        )}

        {recording && !done && (
          <div className="mt-2 text-[10.5px] text-white/50 font-medium">
            {s.language === 'en' ? 'EN' : 'RU'} · {s.mode} · Esc — отмена · Alt+Space — вставить
          </div>
        )}
      </div>
    </div>
  );
}
