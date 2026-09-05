// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react';
import { Mic, History, Settings, Info, Download, Github, StickyNote } from 'lucide-react';

const ITEMS = [
  { id: 'dictation', label: 'Диктовка', icon: Mic },
  { id: 'scratchpad', label: 'Черновик', icon: StickyNote },
  { id: 'history', label: 'История', icon: History },
  { id: 'settings', label: 'Настройки', icon: Settings },
  { id: 'about', label: 'О проекте', icon: Info },
];

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex items-end justify-center gap-[2.5px] h-6 w-6">
        {[8, 14, 20, 14, 8].map((h, i) => (
          <span key={i} className="w-[3px] rounded-full bg-ink" style={{ height: h }} />
        ))}
      </div>
      <span className="text-[17px] font-bold tracking-tight">1mesto Flow</span>
    </div>
  );
}

export default function Sidebar({ tab, setTab, hotkey }) {
  return (
    <>
      {/* Desktop: фиксированный сайдбар */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-card/60 px-3 py-5 z-30">
        <Logo />
        <nav className="mt-6 space-y-1">
          {ITEMS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors ${
                  active ? 'bg-accent-soft text-accent-deep font-semibold' : 'text-ink-700 hover:bg-paper'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <a
            href="https://github.com/veberonin/1mesto.ai/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl bg-ink text-paper p-4"
          >
            <div className="text-[13px] font-bold">Flow на компе 💻</div>
            <div className="text-[11px] text-paper/70 mt-0.5 leading-snug">
              Голос в текст в любом приложении по {hotkey || 'Alt+Space'}
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-paper text-ink text-[11.5px] font-bold px-2.5 py-1.5">
              <Download className="w-3.5 h-3.5" /> Скачать
            </span>
          </a>
          <a
            href="https://github.com/veberonin/1mesto.ai"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium text-mute hover:text-ink transition-colors"
          >
            <Github className="w-4 h-4" /> GitHub · MIT
          </a>
        </div>
      </aside>

      {/* Mobile: горизонтальная навигация */}
      <div className="md:hidden flex items-center gap-1.5 px-4 pt-4 overflow-x-auto no-scrollbar">
        <Logo />
        {ITEMS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                active ? 'bg-ink text-paper border-ink' : 'border-line text-mute'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
