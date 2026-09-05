// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import {
  Mic, Square, Trash2, Wand2, Copy, Check, Sparkles, Play, Mail,
  List, MessageSquare, Terminal, AlertTriangle, Keyboard, Zap, Timer,
} from 'lucide-react';
import { useState } from 'react';

const MODES = [
  { id: 'clean', label: 'Умная очистка', icon: Sparkles },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'bullets', label: 'Список', icon: List },
  { id: 'chat', label: 'Чат', icon: MessageSquare },
  { id: 'code', label: 'Код / Tech', icon: Terminal },
];

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export default function DictationTab({
  recording, demoActive, micDenied, language, mode,
  transcript, onTranscriptChange, interim, formatted, formatMeta, processing,
  elapsed, liveWpm, peakWpm,
  onToggleRecording, onDemo, onClear, onAiFormat, onCopy, onModeChange,
  aiEnabled, stats,
}) {
  const [copied, setCopied] = useState(false);
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const active = recording || demoActive;

  const handleCopy = () => {
    onCopy(formatted || transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ================= ЛЕВАЯ КОЛОНКА ================= */}
      <div className="lg:col-span-2 space-y-5">
        {/* Управление записью */}
        <div className="rounded-3xl glass p-5 shadow-card">
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleRecording}
              className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-95 ${
                active
                  ? 'bg-gradient-to-br from-brand-flame to-brand-rose shadow-glow'
                  : 'bg-gradient-to-br from-brand-orange via-brand-flame to-brand-violet shadow-glow hover:scale-[1.04]'
              }`}
            >
              {active && <span className="absolute inset-0 rounded-2xl border border-white/50 animate-pulse-ring" />}
              {active ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-7 h-7 text-white" />}
            </button>

            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[17px] leading-tight">
                {active ? (demoActive ? 'Идёт демо-диктовка…' : 'Слушаю…') : micDenied ? 'Нужен доступ к микрофону' : 'Говори — я напечатаю'}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border tabular-nums ${
                  active ? 'text-brand-orange border-brand-flame/30 bg-brand-flame/10' : 'text-zinc-400 border-white/[0.07] bg-white/[0.03]'
                }`}>
                  <Timer className="w-3 h-3" /> {fmtTime(elapsed)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-400 tabular-nums">
                  <Zap className="w-3 h-3 text-yellow-400" /> {liveWpm} wpm · пик {Math.max(peakWpm, liveWpm)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-400 tabular-nums">
                  {words} слов
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={onAiFormat}
                disabled={!transcript.trim() || processing}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-brand-violet/30 bg-brand-violet/10 text-violet-300 hover:bg-brand-violet/20 transition-colors disabled:opacity-40"
                title={aiEnabled ? 'Дошлифовать через AI (Gemini/OpenAI)' : 'Подключи AI-ключ в настройках'}
              >
                <Wand2 className="w-3.5 h-3.5" />
                AI-полировка
              </button>
              <button
                onClick={onClear}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Очистить
              </button>
            </div>
          </div>

          {/* Демо-режим */}
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-zinc-500 font-medium mr-1">
              Нет микрофона под рукой? Живое демо пайплайна:
            </span>
            <button
              onClick={() => onDemo('ru')}
              disabled={active}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white/[0.05] border border-white/[0.09] hover:border-brand-flame/40 transition-colors disabled:opacity-40"
            >
              <Play className="w-3 h-3 text-brand-orange" /> Демо RU
            </button>
            <button
              onClick={() => onDemo('en')}
              disabled={active}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white/[0.05] border border-white/[0.09] hover:border-brand-flame/40 transition-colors disabled:opacity-40"
            >
              <Play className="w-3 h-3 text-brand-violet" /> Демо EN
            </button>
          </div>

          {/* Предупреждение о микрофоне */}
          {micDenied && (
            <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] text-[12.5px] leading-relaxed text-amber-200/90">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
              <div>
                {micDenied === 'unsupported' ? (
                  <>
                    <b>Браузер не поддерживает Web Speech API.</b> Открой приложение в Chrome или Edge —
                    там распознавание работает из коробки. А пока попробуй демо-режим или вставь текст руками.
                  </>
                ) : (
                  <>
                    <b>Нет доступа к микрофону.</b> Если ты смотришь превью во встроенном окне — открой его
                    в отдельной вкладке и разреши микрофон. Пока можно нажать «Демо RU/EN» — весь пайплайн
                    отработает на тексте-примере.
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Режимы форматирования */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-600 font-semibold shrink-0 mr-1">Режим</span>
          {MODES.map((m) => {
            const Icon = m.icon;
            const activeMode = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold whitespace-nowrap border transition-all ${
                  activeMode
                    ? 'bg-gradient-to-r from-brand-flame/15 to-brand-violet/15 border-brand-flame/40 text-white shadow-glow-sm'
                    : 'bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${activeMode ? 'text-brand-flame' : ''}`} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Две панели: сырье / результат */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Сырая диктовка */}
          <div className="rounded-3xl glass shadow-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Сырая диктовка</span>
              <span className="text-[11px] text-zinc-600 tabular-nums">{words} слов</span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              spellCheck={false}
              placeholder="Начни говорить через пилюлю сверху — текст появится здесь. Или вставь сырой текст руками и нажми режим…"
              className="flex-1 min-h-[230px] max-h-[340px] w-full resize-none bg-transparent px-4 py-3.5 text-[13.5px] leading-relaxed text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
            />
            {interim && (
              <div className="px-4 py-2 border-t border-white/[0.06] text-[12.5px] italic text-zinc-500 caret truncate">
                {interim}
              </div>
            )}
          </div>

          {/* Результат Flow */}
          <div className="rounded-3xl border border-brand-flame/25 bg-gradient-to-b from-brand-flame/[0.06] to-transparent shadow-card flex flex-col overflow-hidden relative">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-flame/10 blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
                <Sparkles className="w-3.5 h-3.5 text-brand-flame" />
                <span className="text-gradient-soft">Результат Flow</span>
              </span>
              {formatMeta && (
                <span className="flex items-center gap-1.5">
                  {formatMeta.removedFillers > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold">
                      −{formatMeta.removedFillers} паразитов
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    formatMeta.source === 'ai'
                      ? 'bg-brand-violet/15 border border-brand-violet/30 text-violet-300'
                      : 'bg-white/[0.05] border border-white/[0.08] text-zinc-500'
                  }`}>
                    {formatMeta.source === 'ai' ? 'AI' : 'локальный AI'}
                  </span>
                </span>
              )}
            </div>
            <div className={`flex-1 min-h-[230px] max-h-[340px] overflow-y-auto px-4 py-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${processing ? 'opacity-50' : ''}`}>
              {formatted || (
                <span className="text-zinc-600 italic">
                  Здесь появится чистый текст: с пунктуацией, запятыми и без «эм… ну… как бы…»
                </span>
              )}
            </div>
            <div className="px-4 py-3 border-t border-white/[0.06]">
              <button
                onClick={handleCopy}
                disabled={!formatted && !transcript}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] ${
                  copied
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                    : 'bg-gradient-to-r from-brand-flame to-brand-rose text-white shadow-glow-sm hover:brightness-110'
                } disabled:opacity-40 disabled:shadow-none`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Скопировано!' : 'Копировать результат'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ПРАВАЯ КОЛОНКА ================= */}
      <div className="space-y-5">
        {/* WPM */}
        <div className="rounded-3xl glass p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Скорость</span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tabular-nums">{liveWpm}</span>
            <span className="text-[12px] text-zinc-500 mb-1.5">слов/мин</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-white/[0.05] border border-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (liveWpm / 220) * 100)}%`,
                background: 'linear-gradient(90deg,#ff8a5c,#f43f6e,#8b5cf6)',
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5 font-medium">
            <span>клавиатура 45</span>
            <span>разговор 130</span>
            <span className="text-brand-orange">Flow 220</span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-[12px]">
            <span className="text-zinc-500">Личный рекорд</span>
            <span className="font-bold text-emerald-400 tabular-nums">{stats.recordWpm || 0} wpm</span>
          </div>
        </div>

        {/* Сегодня */}
        <div className="rounded-3xl glass p-5 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-3">Сегодня</div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[11px] text-zinc-500">слов</div>
              <div className="text-xl font-extrabold tabular-nums">{getTodayWords(stats)}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[11px] text-zinc-500">сессий</div>
              <div className="text-xl font-extrabold tabular-nums text-brand-orange">{getTodaySessions(stats)}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[11px] text-zinc-500">в эфире</div>
              <div className="text-xl font-extrabold tabular-nums text-brand-blue">{Math.round(getTodaySeconds(stats) / 60)} мин</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-[11px] text-zinc-500">сэкономлено</div>
              <div className="text-xl font-extrabold tabular-nums text-emerald-400">{getSaved(stats)} мин</div>
            </div>
          </div>
        </div>

        {/* Последние сессии */}
        <div className="rounded-3xl glass p-5 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-3">Последние сессии</div>
          {(stats.history || []).slice(0, 4).map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-flame/20 to-brand-violet/20 border border-white/[0.06] flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                  {(s.lang || 'ru').toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{s.words} слов · {s.mode}</div>
                  <div className="text-[10.5px] text-zinc-600">{new Date(s.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <span className="text-[13px] font-bold text-emerald-400 tabular-nums">{s.wpm}</span>
            </div>
          ))}
          {!(stats.history || []).length && (
            <div className="text-[12px] text-zinc-600 italic py-2">Пока пусто — скажи что-нибудь 🎙</div>
          )}
        </div>

        {/* Подсказки */}
        <div className="rounded-3xl glass p-5 shadow-card">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-3">
            <Keyboard className="w-3.5 h-3.5" /> Горячие клавиши
          </div>
          <div className="space-y-2 text-[12px]">
            {[
              [['Alt', 'Space'], 'старт / стоп диктовки'],
              [['Esc'], 'остановить'],
              [['«точка», «запятая»'], 'голосовая пунктуация'],
            ].map(([keys, desc]) => (
              <div key={String(desc)} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  {keys.map((k) => (
                    <kbd key={k} className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10.5px] font-semibold">{k}</kbd>
                  ))}
                </span>
                <span className="text-zinc-500 text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers для «сегодня» ---------- */
function todayEntry(stats) {
  const key = new Date().toISOString().slice(0, 10);
  return (stats.days && stats.days[key]) || { words: 0, seconds: 0, sessions: 0 };
}
function getTodayWords(stats) { return todayEntry(stats).words; }
function getTodaySessions(stats) { return todayEntry(stats).sessions; }
function getTodaySeconds(stats) { return todayEntry(stats).seconds; }
function getSaved(stats) {
  const total = stats.totalWords || 0;
  return Math.max(0, Math.round(total / 45 - total / 130));
}
