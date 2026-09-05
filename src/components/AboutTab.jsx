// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { Sparkles, Zap, Cpu, BarChart2, ExternalLink, Trophy, ShieldAlert } from 'lucide-react';

export default function AboutTab() {
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="rounded-3xl glass p-8 shadow-card text-center relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-brand-flame/15 blur-3xl rounded-full pointer-events-none" />
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-end justify-center gap-1 pb-4 shadow-glow"
          style={{ background: 'linear-gradient(135deg,#ff8a5c 0%,#f43f6e 55%,#8b5cf6 130%)' }}>
          {[16, 26, 12, 22].map((h, i) => (
            <span key={i} className="w-1 rounded-full bg-white/95" style={{ height: h / 1.6 }} />
          ))}
        </div>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
          1mesto <span className="text-gradient">Flow</span>
        </h2>
        <p className="text-[13px] text-zinc-500 mt-1">v2.0 · хакатон · open source (MIT)</p>
        <p className="text-[13.5px] text-zinc-300 leading-relaxed max-w-xl mx-auto mt-4">
          Рабочий клон <b>Wispr Flow</b>, собранный за хакатон: мгновенная диктовка через Web Speech API,
          умная очистка речи от слов-паразитов, живая звуковая волна, WPM-аналитика и демо-режим,
          который работает даже без микрофона.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          <a
            href="https://wisprflow.ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold bg-white/[0.05] border border-white/[0.09] hover:border-white/25 transition-colors"
          >
            Оригинал: wisprflow.ai <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://github.com/veberonin/1mesto.ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold bg-gradient-to-r from-brand-flame to-brand-rose text-white shadow-glow-sm hover:brightness-110 transition-all"
          >
            GitHub: veberonin/1mesto.ai <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            icon: Zap, title: 'Скорость мысли',
            text: 'Web Speech API распознаёт речь в реальном времени, локальный форматер полирует текст на лету — задержка почти нулевая.',
          },
          {
            icon: Cpu, title: 'Локальный AI-форматер',
            text: 'Убирает «эм», «ну», «как бы», расставляет точки и запятые по грамматике, понимает голосовые команды «точка», «новая строка».',
          },
          {
            icon: Sparkles, title: '5 режимов стиля',
            text: 'Чистый текст, деловое письмо с подписью, маркированный список, дружелюбный чат и техзаметка с подсветкой терминов.',
          },
          {
            icon: BarChart2, title: 'WPM-аналитика',
            text: 'Живая скорость, личные рекорды, график сессий и подсчёт сэкономленных минут против клавиатуры.',
          },
        ].map((f) => (
          <div key={f.title} className="rounded-3xl glass p-5 shadow-card">
            <f.icon className="w-5 h-5 text-brand-flame mb-2.5" />
            <h4 className="font-bold text-[14px] mb-1">{f.title}</h4>
            <p className="text-[12.5px] text-zinc-400 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h3 className="font-bold">Хакатон</h3>
        </div>
        <p className="text-[13px] text-zinc-300 leading-relaxed">
          Главный приз — механическая клавиатура за 50 000 ₽. Наш конёк: полный цикл
          «голос → чистый текст» работает прямо в браузере без установки, плюс честное демо
          без микрофона для жюри.
        </p>
      </div>

      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 flex items-start gap-2.5 text-[12px] text-zinc-500 leading-relaxed">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
        Учебный проект-клон, вдохновлённый Wispr Flow. Не аффилирован с Wispr AI, Inc. Все совпадения
        интерфейса — дань уважения великому продукту.
      </div>
    </div>
  );
}
