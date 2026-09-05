import { Mic, BarChart2, Settings, Info, Globe, Github } from 'lucide-react';

function Logo() {
  return (
    <div className="w-9 h-9 rounded-xl flex items-end justify-center gap-[2.5px] pb-[9px] shadow-glow-sm"
      style={{ background: 'linear-gradient(135deg,#ff8a5c 0%,#f43f6e 55%,#8b5cf6 130%)' }}>
      {[10, 16, 8, 14].map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-white/95" style={{ height: h }} />
      ))}
    </div>
  );
}

const TABS = [
  { id: 'dictation', label: 'Диктовка', icon: Mic },
  { id: 'analytics', label: 'Аналитика', icon: BarChart2 },
  { id: 'settings', label: 'Настройки', icon: Settings },
  { id: 'about', label: 'О проекте', icon: Info },
];

export default function Header({ tab, setTab, language, onToggleLanguage, serverOnline }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo />
          <div className="leading-tight min-w-0">
            <div className="font-bold tracking-tight text-[15px] truncate">
              1mesto <span className="text-gradient">Flow</span>
            </div>
            <div className="text-[10px] text-zinc-500 hidden sm:block">Wispr Flow clone · hackathon</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-white/[0.09] text-white shadow-card'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLanguage}
            title="Переключить язык распознавания"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-[12px] font-semibold hover:border-brand-flame/40 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-brand-orange" />
            <span>{language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}</span>
          </button>

          <div
            title={serverOnline ? 'Бэкенд подключён — статистика синхронизируется' : 'Бэкенд недоступен — статистика хранится локально'}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${
              serverOnline
                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                : 'text-zinc-500 border-white/[0.06] bg-white/[0.03]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            {serverOnline ? 'Сервер' : 'Локально'}
          </div>

          <a
            href="https://github.com/veberonin/1mesto.ai"
            target="_blank"
            rel="noreferrer"
            title="GitHub"
            className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* мобильные табы */}
      <div className="md:hidden flex gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
                active ? 'bg-white/[0.09] text-white border-white/10' : 'text-zinc-400 border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
