// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react';
import { Mic, Loader2 } from 'lucide-react';
import Keycaps, { hotkeyParts } from './Keycaps.jsx';

/**
 * Чёрная плавающая пилюля — как в оригинале Wispr Flow.
 */
export default function DictationPill({
  state,
  bars,
  elapsed,
  liveWpm,
  language,
  interim,
  onToggle,
  disabled,
  hotkey,
}) {
  const recording = state === 'recording';
  const processing = state === 'processing';

  const mm = Math.floor(elapsed / 60);
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');

  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-5 z-50 flex flex-col items-center pointer-events-none">
      <button
        onClick={onToggle}
        disabled={disabled}
        title={recording ? 'Остановить (Esc)' : `Начать диктовку (${hotkey || 'Alt+Space'})`}
        className={`pointer-events-auto relative flex items-center gap-3 h-[52px] px-2.5 pr-5 rounded-full border transition-all duration-300 ${
          recording
            ? 'bg-ink-950/95 border-white/25 scale-[1.02]'
            : 'bg-ink-950/95 border-white/10 hover:scale-[1.02]'
        } shadow-pill backdrop-blur-xl`}
      >
        {recording && (
          <span className="absolute inset-0 rounded-full border border-white/30 animate-pulse-ring pointer-events-none" />
        )}

        <span
          className={`ml-0.5 w-9 h-9 rounded-full flex items-center justify-center ${recording ? 'bg-white/10' : 'bg-white'}`}
        >
          {processing ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : recording ? (
            <span className="w-3 h-3 bg-white rounded-[4px]" />
          ) : (
            <Mic className="w-4 h-4 text-ink-950" />
          )}
        </span>

        {recording ? (
          <span className="flex items-end gap-[3px] h-6 w-[78px] justify-center">
            {(bars && bars.length ? bars : [0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.35]).map((v, i) => (
              <span
                key={i}
                className={`w-[3.5px] rounded-full bg-white ${bars && bars.length ? '' : 'fake-bar'}`}
                style={
                  bars && bars.length
                    ? { height: `${Math.max(12, v * 100)}%`, transition: 'height 90ms linear' }
                    : { height: `${20 + (i % 3) * 25}%`, animationDelay: `${i * 0.12}s` }
                }
              />
            ))}
          </span>
        ) : (
          <span className="text-[13px] font-semibold text-white">{processing ? 'Форматирую…' : 'Flow'}</span>
        )}

        {recording ? (
          <span className="flex items-center gap-2 text-[11px] font-semibold tabular-nums text-white/90">
            <span>
              {mm}:{ss}
            </span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="text-accent-soft">{liveWpm} wpm</span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/10 text-white/80">
              {language === 'ru' ? 'RU' : 'EN'}
            </span>
          </span>
        ) : (
          <span className="hidden sm:flex items-center gap-1 text-[10.5px] text-white/60 font-medium">
            {hotkeyParts(hotkey).map((part, i) => (
              <React.Fragment key={part}>
                {i > 0 && '+'}
                <kbd className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/80 text-[10px]">{part}</kbd>
              </React.Fragment>
            ))}
          </span>
        )}
      </button>

      {recording && interim && (
        <div className="pointer-events-none mt-2.5 max-w-[86vw] truncate px-4 py-1.5 rounded-full bg-ink-950/95 border border-white/10 backdrop-blur-xl text-[12.5px] italic text-white/70 caret animate-fade-up">
          {interim}
        </div>
      )}
    </div>
  );
}
