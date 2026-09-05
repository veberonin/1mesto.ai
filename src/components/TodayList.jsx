// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useMemo, useState } from 'react';
import { Copy, RotateCcw, Trash2, Search, Mic } from 'lucide-react';
import Keycaps from './Keycaps.jsx';
import { listUtterances, deleteUtterance } from '../lib/journal.js';
import { isDesktop, desktopAPI } from '../lib/desktop.js';

/**
 * Лента «Сегодня» — как в оригинале: время + текст + действия при наведении.
 * M-01..M-09, T-03/T-04.
 */
export default function TodayList({ refreshKey, privacy, onToast, recording, hotkey }) {
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);

  const records = useMemo(() => {
    const day = new Date().toISOString().slice(0, 10);
    let r = listUtterances().filter((x) => x.ts.startsWith(day)).reverse();
    if (query) r = r.filter((x) => (x.text || '').toLowerCase().includes(query.toLowerCase()));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, refreshKey, tick]);

  const copy = async (r) => {
    if (!r.text) return onToast('Текст скрыт приватным режимом', 'error');
    try {
      await navigator.clipboard.writeText(r.text);
      onToast('Скопировано ✓', 'success');
    } catch {
      onToast('Не вышло', 'error');
    }
  };

  const reinsert = async (r) => {
    if (!r.text) return onToast('Текст скрыт приватным режимом', 'error');
    if (isDesktop()) {
      await desktopAPI.insertText(r.text);
      onToast('Вставлено ✓', 'success');
    } else {
      await copy(r);
    }
  };

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <span className="text-[12px] font-bold tracking-[0.12em] text-mute">СЕГОДНЯ</span>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className="w-36 sm:w-48 rounded-lg border border-line bg-paper/70 pl-8 pr-2.5 py-1.5 text-[12.5px] focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {recording && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-accent-soft border border-accent/20 text-[13px] font-medium text-accent-deep">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Идёт запись — говори, реплика появится здесь
        </div>
      )}

      <div className="divide-y divide-line/70">
        {records.map((r) => (
          <div key={r.id} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-paper/60 transition-colors">
            <span className="text-[12px] text-mute tabular-nums w-14 shrink-0">
              {new Date(r.ts).toLocaleTimeString('ru-RU', { hour: 'numeric', minute: '2-digit' })}
            </span>
            <span className="flex-1 text-[14px] truncate">
              {r.text || <span className="text-mute italic">текст скрыт приватным режимом</span>}
            </span>
            <span className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => reinsert(r)} title="Вставить заново" className="p-1.5 rounded-lg hover:bg-accent-soft text-mute hover:text-accent-deep">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => copy(r)} title="Копировать" className="p-1.5 rounded-lg hover:bg-accent-soft text-mute hover:text-accent-deep">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  deleteUtterance(r.id);
                  setTick((t) => t + 1);
                }}
                title="Удалить"
                className="p-1.5 rounded-lg hover:bg-red-50 text-mute hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
            <span className="text-[12px] font-bold text-accent-deep tabular-nums w-12 text-right">{r.wpm || ''}</span>
          </div>
        ))}

        {!records.length && (
          <div className="px-5 py-12 text-center">
            <Mic className="w-6 h-6 text-line mx-auto mb-3" />
            <div className="text-[14px] font-semibold">Пока тихо</div>
            <div className="text-[12.5px] text-mute mt-1">
              Зажми <Keycaps hotkey={hotkey} className="ml-1" /> и скажи что-нибудь —
              реплика появится здесь
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
