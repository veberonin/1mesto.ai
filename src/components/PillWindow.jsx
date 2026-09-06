// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Check, X } from 'lucide-react';
import { SpeechEngine } from '../lib/speech.js';
import { startMicMeter } from '../lib/audio.js';
import { sound } from '../lib/sound.js';
import { formatText, countWordsIn } from '../lib/formatter.js';
import { parsePairsText } from '../lib/dictio.js';
import { isDesktop, desktopAPI } from '../lib/desktop.js';
import { saveSession } from '../lib/stats.js';
import { WavCapture } from '../lib/recorder.js';

const MAX_SEC = 300; // авто-стоп длинной реплики

/**
 * Пилюля для десктоп-режима: живёт в отдельном прозрачном always-on-top окне.
 * Глобальный хоткей Alt+Space (main-процесс) показывает окно и стартует запись.
 * Остановка → форматирование → автоВСТАВКА в приложение, где стоял курсор.
 * Любая ошибка → сообщение и АВТО-СКРЫТИЕ: зависшая пилюля исключена по построению.
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
  const finishRef = useRef(null);
  const startFnRef = useRef(null);
  const settingsRef = useRef({
    language: 'ru',
    mode: 'clean',
    name: '',
    provider: 'none',
    apiKey: '',
    dictText: '',
    macrosText: '',
  });

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

  const releaseCapture = () => {
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
  };

  const finish = async (cancel = false) => {
    if (!recordingRef.current || doneRef.current) {
      desktopAPI.hidePill(); // зомби-состояние (показ без записи) — не висим
      return;
    }
    // D-10: удержание менее 200 мс не создаёт пустую реплику
    if (!cancel && startRef.current && Date.now() - startRef.current < 200) {
      doneRef.current = true;
      recordingRef.current = false;
      stopMachines();
      desktopAPI.setStatus(false);
      desktopAPI.hidePill();
      return;
    }
    doneRef.current = true;
    recordingRef.current = false;
    stopMachines();
    desktopAPI.setStatus(false); // B-11
    setRecording(false);
    setInterim('');

    let hideDelay = 1800; // экран ошибки/пусто — показать и скрыть
    const finishOutcome = () => {
      hideDelay = 250; // успех: окно уже спрятал main, просто страховка
    };

    try {
      if (cancel) {
        hideDelay = 50;
        return;
      }

      let raw = transcriptRef.current.trim();

      // Фолбэк: Speech API не дал текста → локальное распознавание по WAV-записи (whisper.cpp → Gemini)
      if (!raw && captureRef.current) {
        try {
          const wav = captureRef.current.stop();
          captureRef.current = null;
          setError('Распознаю локально…');
          const res = await desktopAPI.transcribe(wav, settingsRef.current.language === 'en' ? 'en' : 'ru');
          if (res && res.text) {
            transcriptRef.current = res.text;
            raw = res.text.trim();
          } else if (res && res.hint) {
            setError(res.hint);
          }
        } catch {
          /* остаёмся с «не расслышал» */
        }
      }
      releaseCapture();

      if (!raw) {
        if (!error) setError('Ничего не расслышал');
        sound.error();
        return; // finally скроет
      }

      const s = settingsRef.current;
      const durSec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      const words = countWordsIn(raw);
      const wpm = durSec >= 3 ? Math.round(words / (durSec / 60)) : 0;
      const pairs = parsePairsText(`${s.dictText || ''}\n${s.macrosText || ''}`);

      // формат: AI (если настроен) → локальный (со словарём и макросами, H-01)
      let text = formatText(raw, {
        mode: s.mode,
        lang: s.language,
        name: s.name,
        dict: pairs.dict,
        macros: pairs.macros,
        voiceCommands: s.voiceCommands !== false,
        restoreYo: !!s.restoreYo,
      }).text;
      try {
        if (s.provider && s.provider !== 'none') {
          const res = await desktopAPI.aiFormat({
            text: raw,
            mode: s.mode,
            language: s.language,
            provider: s.provider,
            apiKey: s.apiKey,
            name: s.name,
            dict: pairs.dict,
            macros: pairs.macros,
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
      finishOutcome(true);
    } catch (e) {
      console.error('pill finish failed:', e);
      setError('Сбой вставки — текст в буфере обмена');
      try {
        if (transcriptRef.current.trim()) await desktopAPI.insertText(transcriptRef.current.trim());
      } catch {
        /* ну хоть попробовали */
      }
    } finally {
      const delay = hideDelay;
      // пилюля исчезает всегда, НО хвост старой сессии не прячет окно новой записи
      setTimeout(() => {
        if (!recordingRef.current) desktopAPI.hidePill();
      }, delay);
    }
  };
  finishRef.current = finish;

  /** Каждое появление окна = новая диктовка: сброс и старт с чистого листа */
  const restart = () => {
    if (recordingRef.current) return; // уже пишем
    doneRef.current = false;
    transcriptRef.current = '';
    wordsRef.current = 0;
    setDone(false);
    setInserted(null);
    setError('');
    setInterim('');
    setElapsed(0);
    setLiveWpm(0);
    setBars([]);
    startFnRef.current && startFnRef.current();
  };

  const start = async () => {
    try {
      if (!isDesktop()) {
        setError('Пилюля работает только в десктоп-приложении');
        setTimeout(() => desktopAPI.hidePill(), 2500);
        return;
      }

      desktopAPI.setStatus(true); // B-11: трей показывает «идёт запись»
      sound.start();
      startRef.current = Date.now();
      wordsRef.current = 0;
      transcriptRef.current = '';
      recordingRef.current = true;
      setRecording(true);
      setDone(false);
      setInserted(null);
      setError('');

      timerRef.current = setInterval(() => {
        const sec = (Date.now() - startRef.current) / 1000;
        setElapsed(sec);
        setLiveWpm(sec > 2.5 ? Math.round(wordsRef.current / (sec / 60)) : 0);
        if (sec > MAX_SEC && recordingRef.current) finishRef.current(false);
      }, 400);

      startMicMeter((levels) => setBars(levels.bars))
        .then((m) => {
          meterRef.current = m;
        })
        .catch(() => {});

      // Параллельно пишем WAV: если Speech API молчит — распознаем локально
      try {
        captureRef.current = new WavCapture();
        if (settingsRef.current?.vadThreshold)
          captureRef.current.vadThreshold = settingsRef.current.vadThreshold; // E-04
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
          else if (code === 'no-mic') setError('Микрофон не найден');
          else if (code === 'network') setInterim(''); // текст даст локальный ASR по записи
          if (code === 'denied' || code === 'no-mic') {
            sound.error();
            recordingRef.current = false;
            doneRef.current = true;
            stopMachines();
            releaseCapture();
            setRecording(false);
            setTimeout(() => desktopAPI.hidePill(), 2500); // не висим
          }
        },
      });
      const ok = engineRef.current.start(settingsRef.current.language === 'en' ? 'en-US' : 'ru-RU');
      if (!ok && !captureRef.current) {
        setError('Распознавание недоступно: настрой whisper в Настройках');
        recordingRef.current = false;
        doneRef.current = true;
        stopMachines();
        setRecording(false);
        setTimeout(() => desktopAPI.hidePill(), 3000);
      }
    } catch (e) {
      console.error('pill start failed:', e);
      setError('Не удалось начать запись');
      recordingRef.current = false;
      doneRef.current = true;
      stopMachines();
      releaseCapture();
      setRecording(false);
      setTimeout(() => desktopAPI.hidePill(), 2500);
    }
  };
  startFnRef.current = start; // после объявления start (избегаем TDZ)

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
      if (cmd === 'start') restart();
      if (cmd === 'stop') finishRef.current && finishRef.current(false);
      if (cmd === 'cancel') finishRef.current && finishRef.current(true);
      if (cmd === 'mode') {
        // D-15: профиль стиля переключён хоткеем — подтягиваем настройки
        desktopAPI
          .getSettings()
          .then((st) => {
            if (st) settingsRef.current = Object.assign({}, settingsRef.current, st);
          })
          .catch(() => {});
      }
    });

    // Самолечение: любая непойманная ошибка не должна оставлять висящую пилюлю
    const heal = (msg) => {
      console.error('pill window:', msg);
      setTimeout(() => {
        if (!recordingRef.current) desktopAPI.hidePill();
      }, 1500);
    };
    const onErr = (e) => heal(e.message || 'error');
    const onRej = (e) => heal((e.reason && e.reason.message) || 'unhandled rejection');
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);

    const esc = (e) => {
      if (e.code === 'Escape') finishRef.current && finishRef.current(true);
    };
    window.addEventListener('keydown', esc);

    return () => {
      disposed = true;
      window.removeEventListener('keydown', esc);
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
      stopMachines();
      releaseCapture();
      document.documentElement.style.background = '';
    };
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
              (done ? 'bg-emerald-500/90' : recording ? 'bg-white/10' : 'bg-white')
            }
          >
            {done ? (
              <Check className="w-5 h-5 text-white" />
            ) : recording ? (
              <span className="w-3.5 h-3.5 bg-white rounded-[4px]" />
            ) : (
              <Mic className="w-5 h-5" style={{ color: '#17140F' }} />
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
            <span className="text-[13px] font-semibold text-white/90 px-1 max-w-[360px] truncate">
              {error || 'Flow'}
            </span>
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
              onClick={() => finishRef.current && finishRef.current(true)}
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
