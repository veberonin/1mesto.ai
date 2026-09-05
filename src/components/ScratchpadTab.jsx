// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Copy, Trash2, Plus } from 'lucide-react';

const KEY = 'flow-scratchpad-v1';

/**
 * Черновик (Scratchpad): быстрое место для мыслей с автосохранением.
 * Всё живёт локально, офлайн; можно дополнить последним результатом диктовки.
 */
export default function ScratchpadTab({ lastResult = '', onToast }) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(KEY) || '';
    } catch {
      return '';
    }
  });
  const [saved, setSaved] = useState(true);
  const timerRef = useRef(null);

  // автосохранение с дебаунсом
  useEffect(() => {
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, text);
        setSaved(true);
      } catch {
        /* приватный режим браузера */
      }
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [text]);

  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onToast && onToast('Черновик скопирован ✓', 'success');
    } catch {
      onToast && onToast('Не удалось скопировать', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-[26px] font-bold tracking-tight flex items-center gap-2.5">
          <StickyNote className="w-6 h-6 text-accent" />
          Черновик
        </h1>
        <span className="text-[12px] text-mute">
          {words} слов · {chars} символов · {saved ? 'сохранено ✓' : 'изменено…'}
        </span>
      </div>

      <p className="text-[13px] text-mute mb-3">
        Место для мыслей, которые не жалко: буфер между головой и документом. Автосохранение локально, офлайн.
      </p>

      <div className="glass overflow-hidden flex flex-col">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder="Пиши сюда что угодно — соберёшь мысли позже…"
          className="w-full min-h-[320px] resize-y bg-transparent px-5 py-4 text-[14px] leading-relaxed text-ink-800 placeholder:text-mute/60 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-line/70">
          <button
            onClick={copy}
            disabled={!text}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold bg-ink text-paper disabled:opacity-40"
          >
            <Copy className="w-3.5 h-3.5" /> Копировать
          </button>
          <button
            onClick={() => setText((t) => (lastResult ? `${t}${t ? '\n\n' : ''}${lastResult}` : t))}
            disabled={!lastResult}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line bg-card disabled:opacity-40"
            title="Добавить последний отформатированный результат в конец черновика"
          >
            <Plus className="w-3.5 h-3.5 text-accent" /> Добавить результат диктовки
          </button>
          <button
            onClick={() => {
              if (text && window.confirm('Очистить черновик?')) setText('');
            }}
            disabled={!text}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line text-mute hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Очистить
          </button>
        </div>
      </div>
    </div>
  );
}
