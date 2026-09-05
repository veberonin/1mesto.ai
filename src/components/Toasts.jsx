// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[70] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up flex items-center gap-2.5 px-4 py-3 rounded-xl bg-ink text-paper shadow-pop text-[13px] font-medium max-w-[340px]"
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
          {t.type === 'error' && <AlertTriangle className="w-4 h-4 text-orange-300 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-paper/60 shrink-0" />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
