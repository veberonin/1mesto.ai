export default function Hero() {
  return (
    <section className="text-center pt-10 pb-2">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 animate-fade-up">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-flame animate-pulse" />
        Wispr Flow clone · хакатон
      </div>

      <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] animate-fade-up">
        Не печатай.
        <br />
        <em className="text-gradient not-italic italic font-extrabold">Просто говори.</em>
      </h1>

      <p className="mt-4 text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
        Голос превращается в чистый, отформатированный текст в любом приложении —
        со скоростью мысли. Без «эм», без «ну», без опечаток.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[
          ['⚡', '4× быстрее печати'],
          ['🪄', 'AI убирает слова-паразиты'],
          ['🌍', 'RU / EN'],
          ['📈', 'WPM-аналитика'],
        ].map(([e, t]) => (
          <span
            key={t}
            className="px-3.5 py-1.5 rounded-full glass text-[12px] font-medium text-zinc-300"
          >
            <span className="mr-1">{e}</span>
            {t}
          </span>
        ))}
      </div>

      <div className="mt-8 overflow-hidden">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 mb-2.5">Работает в любом поле ввода</div>
        <div className="flex justify-center flex-wrap gap-x-5 gap-y-1.5 text-[13px] font-semibold text-zinc-500">
          {['Notion', 'Slack', 'VS Code', 'Telegram', 'Gmail', 'Cursor', 'ChatGPT', 'Docs', 'Linear'].map((a) => (
            <span key={a} className="hover:text-zinc-300 transition-colors cursor-default">{a}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
