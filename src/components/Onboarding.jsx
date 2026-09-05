// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import Keycaps from './Keycaps.jsx';
import { isDesktop, desktopAPI } from '../lib/desktop.js';

/**
 * Первый запуск (B-01): микрофон → распознавание → хоткей. Лёгкий онбординг.
 */
export default function Onboarding({ onDone, hotkey }) {
  const [step, setStep] = useState(0);
  const [micOk, setMicOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const testMic = async () => {
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicOk(true);
    } catch {
      setMicOk(false);
    } finally {
      setBusy(false);
    }
  };

  const finish = () => onDone();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="glass max-w-md w-full p-7 shadow-pop">
        <div className="text-[11px] font-bold tracking-[0.14em] text-mute">ШАГ {step + 1} ИЗ 3</div>

        {step === 0 && (
          <div className="mt-3">
            <h3 className="text-xl font-bold">Разреши микрофон</h3>
            <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed">
              Flow слушает только когда ты держишь запись. Ничего не пишется в фоне.
            </p>
            <button
              onClick={testMic}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-ink text-paper py-3 text-[13.5px] font-bold disabled:opacity-60"
            >
              {busy ? 'Проверяю…' : micOk ? '✓ Микрофон работает' : 'Проверить микрофон'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="mt-3">
            <h3 className="text-xl font-bold">Распознавание речи</h3>
            <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed">
              {isDesktop() ? (
                <>
                  В приложении доступно <b>локальное распознавание</b> (whisper.cpp, офлайн). Настрой его в
                  «Настройки → Распознавание»: скачай модель одной кнопкой и укажи бинарь whisper. До этого
                  голосовой ввод требует интернет.
                </>
              ) : (
                <>
                  В браузере используется встроенное распознавание Chrome — нужен интернет. В{' '}
                  <b>десктоп-приложении</b> доступно полностью офлайн-распознавание.
                </>
              )}
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full rounded-xl bg-ink text-paper py-3 text-[13.5px] font-bold"
            >
              Понятно
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-3">
            <h3 className="text-xl font-bold">Горячая клавиша</h3>
            <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed">
              В любом приложении нажми <Keycaps hotkey={hotkey} /> — начнётся запись. Ещё раз — текст
              вставится туда, где стоял курсор.
            </p>
            <button
              onClick={finish}
              className="mt-4 w-full rounded-xl bg-ink text-paper py-3 text-[13.5px] font-bold"
            >
              Поехали 🚀
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : 'w-1.5 bg-line'}`}
              />
            ))}
          </div>
          {step < 2 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="text-[12.5px] font-semibold text-mute hover:text-ink"
            >
              Пропустить →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
