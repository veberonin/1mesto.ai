// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react';
import {
  Mic, Square, Trash2, Copy, Check, Sparkles, Mail, List,
  MessageSquare, Terminal, ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import TodayList from './TodayList.jsx';
import StatRail from './StatRail.jsx';

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
  recording, language, mode,
  transcript, onTranscriptChange, interim, formatted, formatMeta, processing,
  elapsed, liveWpm,
  onToggleRecording, onClear, onAiFormat, onCopy, onModeChange,
  settings, stats, refreshKey, onToast,
}) {
  const [copied, setCopied] = useState(false);
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const active = recording;

  const handleCopy = () => {
    onCopy(formatted || transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Приветствие с хоткеями — как в оригинале */}
      <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight">
        Привет{settings.name ? `, ${settings.name}` : ''} — вернись в поток с{' '}
        <span className="keycap">Alt</span> <span className="keycap">Space</span>
      </h1>

      {/* Тёмный баннер «Попробуй в другом приложении» */}
      <div className="rounded-2xl bg-ink-950 text-paper overflow-hidden relative">
        <div className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(600px 200px at 80% 0%, rgba(221,91,10,0.25), transparent)' }} />
        <div className="relative p-6 sm:p-7 flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-[260px]">
            <div className="font-serif italic text-[22px] sm:text-[24px]">Попробуй Flow в другом приложении</div>
            <div className="text-[13.5px] text-paper/70 mt-1">Flow работает везде, где ты печатаешь.</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleRecording}
              className={`flex items-center gap-2.5 rounded-full h-11 pl-2.5 pr-5 font-bold text-[13.5px] transition-all ${
                active ? 'bg-accent text-white' : 'bg-paper text-ink hover:scale-[1.03]'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center ${active ? 'bg-white/15' : 'bg-ink'}`}>
                {active ? <Square className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-paper" />}
              </span>
              {active ? 'Остановить' : 'Начать'}
            </button>
            <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-paper/70">
              или жми <span className="keycap !border-paper/60 !bg-white/10 !text-paper !shadow-none">Alt</span>
              <span className="keycap !border-paper/60 !bg-white/10 !text-paper !shadow-none">Space</span>
            </span>
          </div>
        </div>
      </div>

      {/* Статус записи */}
      {active && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/25 text-accent-deep">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Слушаю… · {fmtTime(elapsed)} · {liveWpm} wpm · {words} слов
          </span>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-mute hover:text-red-600 hover:border-red-200"
          >
            <Trash2 className="w-3.5 h-3.5" /> Сбросить
          </button>
        </div>
      )}

      {/* Сегодня + правая колонка */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TodayList refreshKey={refreshKey} privacy={settings.privacy} onToast={onToast} recording={active} />
        </div>
        <StatRail stats={stats} />
      </div>

      {/* Последняя реплика: сырьё → результат */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.12em] text-mute mr-1">СТИЛЬ</span>
          {MODES.map((m) => {
            const Icon = m.icon;
            const activeMode = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all ${
                  activeMode ? 'bg-ink text-paper border-ink' : 'bg-card border-line text-mute hover:text-ink'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
          <button
            onClick={onAiFormat}
            disabled={!transcript.trim() || processing}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border border-line bg-card hover:border-accent disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" /> AI-полировка
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-line/70">
              <span className="text-[11px] font-bold tracking-[0.12em] text-mute">СЫРАЯ ДИКТОВКА</span>
              <span className="text-[11px] text-mute tabular-nums">{words} слов</span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              spellCheck={false}
              placeholder="Скажи что-нибудь через пилюлю — или вставь текст руками…"
              className="flex-1 min-h-[150px] max-h-[260px] w-full resize-none bg-transparent px-4 py-3 text-[13.5px] leading-relaxed text-ink-800 placeholder:text-mute/60 focus:outline-none"
            />
            {interim && (
              <div className="px-4 py-2 border-t border-line/70 text-[12.5px] italic text-mute caret truncate">{interim}</div>
            )}
          </div>

          <div className="glass overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-line/70">
              <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-ink">
                <Sparkles className="w-3.5 h-3.5 text-accent" /> РЕЗУЛЬТАТ FLOW
              </span>
              {formatMeta && formatMeta.removedFillers > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-accent-soft text-accent-deep text-[10px] font-bold">
                  −{formatMeta.removedFillers} паразитов
                </span>
              )}
            </div>
            <div className={`flex-1 min-h-[150px] max-h-[260px] overflow-y-auto px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap ${processing ? 'opacity-50' : ''}`}>
              {formatted || <span className="text-mute/70 italic">Здесь появится чистый текст: пунктуация, заглавные, без «эм… ну…»</span>}
            </div>
            <div className="px-4 py-3 border-t border-line/70">
              <button
                onClick={handleCopy}
                disabled={!formatted && !transcript}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] ${
                  copied ? 'bg-accent-soft text-accent-deep border border-accent/30' : 'bg-ink text-paper hover:bg-ink-800'
                } disabled:opacity-40`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Скопировано!' : 'Копировать результат'}
              </button>
            </div>
          </div>
        </div>

        {/* Ссылка «в другое приложение» */}
        <button
          onClick={() => onCopy(formatted || transcript)}
          disabled={!formatted && !transcript}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-deep hover:underline disabled:opacity-40"
        >
          Вставить в другое приложение <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
