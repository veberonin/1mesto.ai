// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useMemo, useState } from 'react';
import { Search, Copy, RotateCcw, Trash2, Download, ShieldOff, RefreshCw } from 'lucide-react';
import {
  listUtterances,
  searchUtterances,
  filterUtterances,
  deleteUtterance,
  clearJournal,
  exportJSONL,
  exportCSV,
  exportJSON,
  exportMarkdown,
  downloadFile,
  journalSummary,
} from '../lib/journal.js';
import { isDesktop, desktopAPI } from '../lib/desktop.js';

/**
 * История реплик (M-01..M-18) + сводка (T-03..T-08) + CSV/JSONL экспорт (AL-12).
 */
export default function HistoryTab({ privacy, onToast }) {
  const [query, setQuery] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  const records = useMemo(() => {
    let r = query ? searchUtterances(query) : listUtterances();
    if (appFilter) r = filterUtterances({ app: appFilter });
    return [...r].reverse(); // свежие сверху
  }, [query, appFilter, tick]);

  const summary = useMemo(() => journalSummary(), [tick]);
  const apps = Object.keys(summary.byApp);

  const reinsert = async (r) => {
    const text = r.text || '';
    if (!text) return onToast('Запись в приватном режиме — текста нет', 'error');
    if (isDesktop()) {
      await desktopAPI.insertText(text);
      onToast('Вставлено в активное окно ✓', 'success');
    } else {
      try {
        await navigator.clipboard.writeText(text);
        onToast('Скопировано в буфер ✓', 'success');
      } catch {
        onToast('Браузер не дал доступ к буферу', 'error');
      }
    }
  };

  const copyOne = async (r) => {
    if (!r.text) return onToast('Текст скрыт приватным режимом', 'error');
    try {
      await navigator.clipboard.writeText(r.text);
      onToast('Скопировано ✓', 'success');
    } catch {
      onToast('Не вышло скопировать', 'error');
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ['Реплик всего', summary.total],
          ['За сегодня', summary.todayCount],
          ['Слов сегодня', summary.todayWords],
          ['Средний WPM', summary.avgWpm],
          ['p95 финала, мс', summary.p95FinalMs],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl glass p-5 shadow-card">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</div>
            <div className="mt-1.5 text-2xl font-extrabold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Приложения + приватность */}
      <div className="rounded-3xl glass p-5 shadow-card flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 mr-2">
          Приложения
        </span>
        {apps.length ? (
          apps.map((a) => (
            <button
              key={a}
              onClick={() => setAppFilter(appFilter === a ? '' : a)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors ${
                appFilter === a
                  ? 'border-brand-flame/50 bg-brand-flame/10 text-white'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {a} · {summary.byApp[a]}
            </button>
          ))
        ) : (
          <span className="text-[12.5px] text-zinc-600 italic">пока нет записей</span>
        )}
        {privacy && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-amber-500/25 bg-amber-500/[0.07] text-amber-300">
            <ShieldOff className="w-3.5 h-3.5" /> Приватный режим: текст не пишется
          </span>
        )}
      </div>

      {/* Поиск + действия */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по истории (M-04)…"
            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none focus:border-brand-flame/50"
          />
        </div>
        <button
          onClick={refresh}
          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.09] text-zinc-400 hover:text-white"
          title="Обновить"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            downloadFile('flow-history.jsonl', exportJSONL(), 'application/x-ndjson');
            onToast('JSONL выгружен', 'success');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold bg-white/[0.04] border border-white/[0.09] hover:border-white/20"
        >
          <Download className="w-3.5 h-3.5" /> JSONL
        </button>
        <button
          onClick={() => {
            downloadFile('flow-stats.csv', exportCSV(), 'text/csv');
            onToast('CSV выгружен', 'success');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold bg-white/[0.04] border border-white/[0.09] hover:border-white/20"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <button
          onClick={() => {
            downloadFile('flow-history.md', exportMarkdown(), 'text/markdown');
            onToast('Markdown выгружен', 'success');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold bg-white/[0.04] border border-white/[0.09] hover:border-white/20"
        >
          <Download className="w-3.5 h-3.5" /> Markdown
        </button>
        <button
          onClick={() => {
            downloadFile('flow-history.json', exportJSON(), 'application/json');
            onToast('JSON выгружен', 'success');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold bg-white/[0.04] border border-white/[0.09] hover:border-white/20"
        >
          <Download className="w-3.5 h-3.5" /> JSON
        </button>
        <button
          onClick={() => {
            if (window.confirm('Очистить всю историю реплик?')) {
              clearJournal();
              refresh();
              onToast('История очищена', 'info');
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold border border-red-500/25 bg-red-500/[0.07] text-red-400 hover:bg-red-500/15"
        >
          <Trash2 className="w-3.5 h-3.5" /> Очистить
        </button>
      </div>

      {/* Записи */}
      <div className="space-y-2">
        {records.slice(0, 200).map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">
                {r.text || <span className="text-zinc-600 italic">— текст скрыт приватным режимом —</span>}
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5">
                {new Date(r.ts).toLocaleString('ru-RU')} · {r.app} · {r.words} сл · {r.mode} · {r.source}
                {r.pasteMethod ? ` · ${r.pasteMethod}` : ''}
                {r.dictHits?.length ? ` · словарь: ${r.dictHits.join(', ')}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[13px] font-bold text-emerald-400 tabular-nums mr-1">{r.wpm}</span>
              <button
                onClick={() => reinsert(r)}
                title="Вставить заново (M-07)"
                className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-zinc-400 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => copyOne(r)}
                title="Копировать (M-08)"
                className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-zinc-400 hover:text-white"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  deleteUtterance(r.id);
                  refresh();
                }}
                title="Удалить (M-09)"
                className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!records.length && (
          <div className="py-10 text-center text-[13px] text-zinc-600 italic">
            Пусто. Продиктуй что-нибудь — записи появятся здесь автоматически.
          </div>
        )}
      </div>
    </div>
  );
}
