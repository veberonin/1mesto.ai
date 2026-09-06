// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Обёртка над Web Speech API с автоперезапуском (Chrome любит обрывать
 * сессию распознавания при тишине — как настоящий Wispr Flow, мы её возобновляем).
 */

import { sanitizeTranscript } from './asr-guard.js';

export function isSpeechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class SpeechEngine {
  constructor({ onFinal, onInterim, onError, onEnd } = {}) {
    this.onFinal = onFinal || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onError = onError || (() => {});
    this.onEnd = onEnd || (() => {});
    this.alive = false;
    this.recognition = null;
    this.lang = 'ru-RU';
    this._restarts = 0;
  }

  _create() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          const piece = res[0].transcript.trim();
          // F-22 для Web Speech: Google галлюцинирует титры фильмов на тишине/
          // фоновом ТВ — чистим тем же guard'ом, что и whisper/Gemini
          const { text: cleanPiece } = sanitizeTranscript(piece);
          if (cleanPiece) this.onFinal(cleanPiece);
        } else {
          interim += res[0].transcript;
        }
      }
      this.onInterim(interim);
    };

    rec.onerror = (event) => {
      const err = event.error;
      if (err === 'no-speech' || err === 'aborted') return; // нормальные события
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.alive = false;
        this.onError('denied');
      } else if (err === 'network') {
        this.onError('network');
      } else if (err === 'audio-capture') {
        this.alive = false;
        this.onError('no-mic');
      } else {
        this.onError(err);
      }
    };

    rec.onend = () => {
      if (this.alive) {
        // Автоперезапуск с ограничением, чтобы не крутисть бесконечно при ошибке
        if (this._restarts < 200) {
          this._restarts += 1;
          setTimeout(() => {
            if (!this.alive) return;
            try {
              rec.start();
            } catch {
              /* already started */
            }
          }, 220);
        } else {
          this.alive = false;
          this.onEnd();
        }
      } else {
        this.onEnd();
      }
    };

    return rec;
  }

  start(lang = 'ru-RU') {
    this.stop(true);
    this.lang = lang;
    this.alive = true;
    this._restarts = 0;
    this.recognition = this._create();
    try {
      this.recognition.start();
      return true;
    } catch {
      this.alive = false;
      return false;
    }
  }

  /** @param {boolean} soft — true, если это внутренний перезапуск, а не остановка пользователем */
  stop(soft = false) {
    const wasAlive = this.alive;
    this.alive = false;
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        /* noop */
      }
      this.recognition = null;
    }
    if (wasAlive && !soft) this.onEnd();
  }
}
