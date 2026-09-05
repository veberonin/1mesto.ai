import { Wand2, User, Volume2, Keyboard, Server, Trash2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

function Toggle({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{label}</div>
        {desc && <div className="text-[11.5px] text-zinc-500 mt-0.5">{desc}</div>}
      </div>
      <button className="switch" data-on={!!value} onClick={() => onChange(!value)} aria-label={label}>
        <span />
      </button>
    </div>
  );
}

const PROVIDERS = [
  { id: 'none', name: 'Без AI', desc: 'Только локальный умный форматер — работает офлайн' },
  { id: 'gemini', name: 'Google Gemini', desc: 'gemini-1.5-flash — быстрый и бесплатный по квоте' },
  { id: 'openai', name: 'OpenAI', desc: 'gpt-4o-mini — дороговато, но блестяще' },
];

export default function SettingsTab({ settings, onChange, serverOnline, onCheckServer, onResetStats }) {
  const [showKey, setShowKey] = useState(false);

  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* AI */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-brand-violet" />
          <h3 className="font-bold">AI-полировка текста</h3>
        </div>
        <p className="text-[12px] text-zinc-500 mb-4">
          Локальный форматер уже убирает паразитов и ставит пунктуацию. Внешний AI добавит глубину:
          перепишет корявые фразы и подгонит тон.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => set({ provider: p.id })}
              className={`p-3.5 rounded-2xl text-left border transition-all ${
                settings.provider === p.id
                  ? 'border-brand-flame/50 bg-gradient-to-b from-brand-flame/10 to-transparent shadow-glow-sm'
                  : 'border-white/[0.07] bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <div className="text-[13px] font-bold">{p.name}</div>
              <div className="text-[10.5px] text-zinc-500 mt-0.5 leading-snug">{p.desc}</div>
            </button>
          ))}
        </div>

        {settings.provider !== 'none' && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 block mb-1.5">
              API-ключ ({settings.provider === 'gemini' ? 'Google AI Studio' : 'OpenAI'})
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey || ''}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder={settings.provider === 'gemini' ? 'AIza…' : 'sk-…'}
                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl pl-4 pr-11 py-3 text-[13px] font-mono focus:outline-none focus:border-brand-flame/50"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-zinc-600 mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Ключ живёт только в твоём браузере (localStorage) и уходит лишь на твой сервер → провайдеру.
            </p>
          </div>
        )}
      </div>

      {/* Поведение */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="w-4 h-4 text-brand-orange" />
          <h3 className="font-bold">Поведение</h3>
        </div>
        <div className="divide-y divide-white/[0.05]">
          <Toggle
            label="Форматировать на лету"
            desc="Чистый текст появляется прямо во время диктовки"
            value={settings.autoFormat}
            onChange={(v) => set({ autoFormat: v })}
          />
          <Toggle
            label="Автокопирование"
            desc="После остановки результат сам попадает в буфер обмена"
            value={settings.autoCopy}
            onChange={(v) => set({ autoCopy: v })}
          />
          <Toggle
            label="Звуки интерфейса"
            desc="Фирменные блипы старта и остановки записи"
            value={settings.soundOn}
            onChange={(v) => set({ soundOn: v })}
          />
        </div>
      </div>

      {/* Персонализация */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-brand-blue" />
          <h3 className="font-bold">Персонализация</h3>
        </div>
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 block mb-1.5">
          Подпись в email-режиме
        </label>
        <input
          value={settings.name || ''}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Например: Веберонин"
          className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-brand-flame/50"
        />
      </div>

      {/* Сервер и данные */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold">Сервер и данные</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCheckServer}
            className={`px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border transition-colors ${
              serverOnline
                ? 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300'
                : 'border-white/[0.09] bg-white/[0.04] text-zinc-300 hover:border-white/20'
            }`}
          >
            {serverOnline ? '● Сервер подключён' : '○ Проверить сервер'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Сбросить всю статистику?')) onResetStats();
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-red-500/25 bg-red-500/[0.07] text-red-400 hover:bg-red-500/15 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Очистить данные
          </button>
        </div>
        <p className="text-[11.5px] text-zinc-600 mt-3">
          Статистика всегда пишется в localStorage, а при живом бэкенде ещё и зеркалится на сервер (Express + JSON).
        </p>
      </div>

      {/* Горячие клавиши */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="w-4 h-4 text-zinc-400" />
          <h3 className="font-bold">Горячие клавиши</h3>
        </div>
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between items-center">
            <span className="flex gap-1">
              <kbd className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-semibold">Alt</kbd>
              <kbd className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-semibold">Space</kbd>
            </span>
            <span className="text-zinc-500">старт / стоп диктовки</span>
          </div>
          <div className="flex justify-between items-center">
            <kbd className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-semibold">Esc</kbd>
            <span className="text-zinc-500">экстренная остановка</span>
          </div>
        </div>
      </div>
    </div>
  );
}
