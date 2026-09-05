import { Mic, Loader2 } from 'lucide-react';

/**
 * Плавающая пилюля — фирменный элемент Wispr Flow.
 * Состояния: idle → recording (волна) → processing (форматирую).
 */
export default function DictationPill({ state, bars, elapsed, liveWpm, language, interim, onToggle, disabled }) {
  const recording = state === 'recording';
  const processing = state === 'processing';

  const mm = Math.floor(elapsed / 60);
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');

  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-[72px] z-50 flex flex-col items-center pointer-events-none">
      <button
        onClick={onToggle}
        disabled={disabled}
        title={recording ? 'Остановить (Esc)' : 'Начать диктовку (Alt+Space)'}
        className={`pointer-events-auto relative group flex items-center gap-3 h-[54px] px-2 pr-5 rounded-full pill border transition-all duration-300 ${
          recording
            ? 'bg-[#1d1116]/90 border-brand-flame/40 shadow-glow scale-[1.02]'
            : 'bg-[#141419]/90 border-white/[0.09] hover:border-white/20 hover:scale-[1.02]'
        } backdrop-blur-xl`}
      >
        {recording && (
          <span className="absolute inset-0 rounded-full border border-brand-flame/50 animate-pulse-ring pointer-events-none" />
        )}

        {/* Кнопка-микрофон */}
        <span
          className={`ml-1.5 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            recording
              ? 'bg-gradient-to-br from-brand-flame to-brand-rose shadow-glow-sm'
              : 'bg-gradient-to-br from-brand-orange via-brand-flame to-brand-violet shadow-glow-sm group-hover:scale-105'
          }`}
        >
          {processing ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : recording ? (
            <span className="w-3 h-3 bg-white rounded-[4px]" />
          ) : (
            <Mic className="w-4 h-4 text-white" />
          )}
        </span>

        {/* Центр: волна или текст */}
        {recording ? (
          <span className="flex items-end gap-[3px] h-6 w-[76px] justify-center">
            {(bars && bars.length ? bars : [0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.35]).map((v, i) => (
              <span
                key={i}
                className={`w-[3.5px] rounded-full bg-gradient-to-t from-brand-flame via-brand-rose to-brand-violet ${bars && bars.length ? '' : 'fake-bar'}`}
                style={
                  bars && bars.length
                    ? { height: `${Math.max(12, v * 100)}%`, transition: 'height 90ms linear' }
                    : { height: `${20 + (i % 3) * 25}%`, animationDelay: `${i * 0.12}s` }
                }
              />
            ))}
          </span>
        ) : (
          <span className="text-[13px] font-semibold text-zinc-200">
            {processing ? 'Форматирую…' : 'Flow'}
          </span>
        )}

        {/* Метаданные */}
        {recording ? (
          <span className="flex items-center gap-2 text-[11px] font-semibold tabular-nums">
            <span className="text-zinc-300">
              {mm}:{ss}
            </span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-brand-orange">{liveWpm} wpm</span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-400">
              {language === 'ru' ? 'RU' : 'EN'}
            </span>
          </span>
        ) : (
          <span className="hidden sm:flex items-center gap-1 text-[10.5px] text-zinc-500 font-medium">
            <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px]">Alt</kbd>
            +
            <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px]">Space</kbd>
          </span>
        )}
      </button>

      {/* Живой interim-текст под пилюлей */}
      {recording && interim && (
        <div className="pointer-events-none mt-2.5 max-w-[86vw] truncate px-4 py-1.5 rounded-full bg-[#141419]/90 border border-white/[0.07] backdrop-blur-xl text-[12.5px] italic text-zinc-400 caret animate-fade-up">
          {interim}
        </div>
      )}
    </div>
  );
}
