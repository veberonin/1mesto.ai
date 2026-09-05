// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { TrendingUp, Trophy, Type, PiggyBank, Trash2, RefreshCw } from 'lucide-react';
import { minutesSaved } from '../lib/stats.js';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-3xl glass p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</span>
        <Icon className={`w-4 h-4 ${accent || 'text-brand-orange'}`} />
      </div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

export default function AnalyticsTab({ stats, onReset, onRefresh, serverOnline }) {
  const history = stats.history || [];
  const recent = history.slice(0, 12).reverse();
  const avgWpm = history.length
    ? Math.round(history.slice(0, 20).reduce((a, s) => a + (s.wpm || 0), 0) / Math.min(20, history.length))
    : 0;
  const totalMin = Math.round((stats.totalSeconds || 0) / 60);
  const saved = Math.round(minutesSaved(stats.totalWords || 0));

  // --- SVG bar chart ---
  const W = 640, H = 190, PAD = 26;
  const maxWpm = Math.max(80, ...recent.map((s) => s.wpm || 0));
  const bw = recent.length ? Math.min(46, (W - PAD * 2) / recent.length * 0.62) : 0;
  const gap = recent.length ? (W - PAD * 2) / recent.length : 0;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Аналитика скорости</h2>
          <p className="text-[12.5px] text-zinc-500 mt-0.5">
            Всё как в оригинальном Wispr Flow: WPM, рекорды и сэкономленное время.
            {serverOnline ? ' Синхронизировано с сервером.' : ' Хранится локально в браузере.'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:border-white/20 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Средний WPM" value={avgWpm} accent="text-brand-orange" />
        <StatCard icon={Trophy} label="Рекорд" value={stats.recordWpm || 0} accent="text-yellow-400" />
        <StatCard icon={Type} label="Слов всего" value={stats.totalWords || 0} accent="text-brand-blue" />
        <StatCard icon={PiggyBank} label="Минут сэкономлено" value={saved} accent="text-emerald-400" />
      </div>

      {/* График */}
      <div className="rounded-3xl glass p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">WPM по сессиям</span>
          <span className="text-[11px] text-zinc-600">клавиатура ≈ 45 · разговор ≈ 130</span>
        </div>
        {recent.length ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
              <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ff8a5c" />
                <stop offset="55%" stopColor="#f43f6e" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={PAD} x2={W - PAD}
                y1={H - PAD - (H - PAD * 2) * f}
                y2={H - PAD - (H - PAD * 2) * f}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1"
              />
            ))}
            {recent.map((s, i) => {
              const h = Math.max(4, ((s.wpm || 0) / maxWpm) * (H - PAD * 2));
              const x = PAD + gap * i + (gap - bw) / 2;
              return (
                <g key={i}>
                  <rect x={x} y={H - PAD - h} width={bw} height={h} rx={Math.min(7, bw / 2)} fill="url(#barGrad)" opacity="0.92">
                    <title>{`${s.words} слов · ${s.wpm} wpm · ${new Date(s.ts).toLocaleString('ru-RU')}`}</title>
                  </rect>
                  <text x={x + bw / 2} y={H - PAD + 14} textAnchor="middle" fontSize="9.5" fill="#71717a">
                    {new Date(s.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </text>
                  <text x={x + bw / 2} y={H - PAD - h - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#a1a1aa">
                    {s.wpm}
                  </text>
                </g>
              );
            })}
            <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          </svg>
        ) : (
          <div className="py-10 text-center text-[13px] text-zinc-600 italic">
            Нет данных — сделай пару диктовок и график оживёт 📈
          </div>
        )}
      </div>

      {/* История */}
      <div className="rounded-3xl glass p-5 shadow-card">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">История диктовок</span>
        <div className="mt-3 space-y-2">
          {history.slice(0, 15).map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-flame/20 to-brand-violet/20 border border-white/[0.06] flex items-center justify-center text-[10px] font-bold shrink-0">
                  {(s.lang || 'ru').toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {s.words} слов · режим «{s.mode}»
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    {new Date(s.ts).toLocaleString('ru-RU')} · {Math.round(s.durSec || 0)} c
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[15px] font-extrabold text-emerald-400 tabular-nums">{s.wpm} wpm</div>
                <div className="text-[10.5px] text-zinc-600">пик {s.peakWpm || s.wpm}</div>
              </div>
            </div>
          ))}
          {!history.length && (
            <div className="py-8 text-center text-[13px] text-zinc-600 italic">История пуста</div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm('Точно сбросить всю статистику? Это действие необратимо.')) onReset();
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-red-500/25 bg-red-500/[0.07] text-red-400 hover:bg-red-500/15 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Сбросить статистику
        </button>
      </div>
    </div>
  );
}
