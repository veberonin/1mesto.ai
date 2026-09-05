// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react';
import { Zap, Flame } from 'lucide-react';
import { journalSummary } from '../lib/journal.js';

/** Правая колонка: total words / wpm / streak / Voice Profile — как в оригинале */
export default function StatRail({ stats }) {
  const sum = journalSummary();
  const totalWords = Math.max(stats.totalWords || 0, sum.totalWordsAll || 0);

  // Day streak (дни подряд с хотя бы одной репликой)
  const days = Object.keys(stats.days || {}).sort();
  let streak = 0;
  if (days.length) {
    const dayMs = 86400000;
    let cursor = new Date();
    const key = (d) => d.toISOString().slice(0, 10);
    if (!stats.days[key(cursor)]) cursor = new Date(cursor.getTime() - dayMs); // сегодня ещё может быть впереди
    while (stats.days[key(cursor)]) {
      streak += 1;
      cursor = new Date(cursor.getTime() - dayMs);
    }
  }

  const profilePct = Math.min(100, Math.round(((stats.totalWords || 0) / 2000) * 100));

  return (
    <div className="space-y-3">
      <div className="glass p-5">
        <div className="text-[26px] font-bold leading-none">{stats.totalWords || 0} <span className="text-[13px] font-medium text-mute">всего слов</span></div>
        <div className="mt-3 text-[26px] font-bold leading-none">{sum.avgWpm || 0} <span className="text-[13px] font-medium text-mute">wpm среднее</span></div>
        <div className="mt-3 text-[26px] font-bold leading-none flex items-center gap-2">
          {streak} <span className="text-[13px] font-medium text-mute">дней подряд</span>
          <Flame className="w-4 h-4 text-accent" />
        </div>
      </div>

      <div className="glass p-5">
        <div className="text-[15px] font-bold">Твой голосовой профиль</div>
        <div className="text-[12px] text-mute mt-0.5">Как ты используешь голос</div>
        <div className="mt-4 h-1.5 rounded-full bg-paper border border-line overflow-hidden">
          <div
            className="h-full rounded-full bg-ink transition-all"
            style={{ width: `${Math.max(3, profilePct)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-mute flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-accent" />
          {profilePct >= 100 ? 'Полностью открыт ✨' : `Откроется в 2К слов · ещё ${2000 - (stats.totalWords || 0)}`}
        </div>
      </div>
    </div>
  );
}
