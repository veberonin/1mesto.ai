import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[70] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#17171d]/95 border border-white/[0.09] shadow-card backdrop-blur-xl text-[13px] font-medium max-w-[340px]"
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {t.type === 'error' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-brand-blue shrink-0" />}
          <span className="text-zinc-200">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
