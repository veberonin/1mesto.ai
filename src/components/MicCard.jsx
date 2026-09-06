// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// C-01..C-06: список аудиоустройств, выбор к следующей реплике, смена без перезапуска
import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';

export default function MicCard({ settings, onChange, onToast }) {
  const [devices, setDevices] = useState([]);
  const [permGranted, setPermGranted] = useState(false);

  const refresh = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      // C-05: после разрешения микрофона label приходят настоящие; список живёт сам
      setDevices(all.filter((d) => d.kind === 'audioinput'));
      const unlabeled = all.some((d) => d.kind === 'audioinput' && !d.label);
      setPermGranted(!unlabeled);
    } catch {
      /* enumerateDevices может отсутствовать — не роняем настройки */
    }
  };

  useEffect(() => {
    refresh();
    // C-05: подключение нового устройства обновляет список без перезапуска
    const handler = () => {
      refresh();
      onToast && onToast('Список микрофонов обновлён', 'info');
    };
    try {
      navigator.mediaDevices.addEventListener('devicechange', handler);
    } catch {
      /* старые браузеры */
    }
    return () => {
      try {
        navigator.mediaDevices.removeEventListener('devicechange', handler);
      } catch {}
    };
    // список обновляется один раз при монтировании + на devicechange
  }, []);

  const askPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      await refresh();
      onToast && onToast('Микрофон разрешён — список обновлён', 'success');
    } catch {
      onToast && onToast('Доступ не дали: проверь настройки приватности браузера/ОС', 'error');
    }
  };

  return (
    <div className="rounded-3xl glass p-6 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-4 h-4 text-accent" />
        <h3 className="font-bold">Микрофон</h3>
      </div>
      {devices.length === 0 || !permGranted ? (
        <div>
          <p className="text-[12px] text-mute mb-3">
            Чтобы увидеть устройства по именам, дай доступ к микрофону один раз.
          </p>
          <button
            onClick={askPermission}
            className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line bg-card hover:border-accent"
          >
            Разрешить и показать устройства
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-mute block mb-1.5">Устройство ввода (C-02)</label>
            <select
              value={settings.micDeviceId || ''}
              onChange={(e) => {
                onChange({ ...settings, micDeviceId: e.target.value }); // применится к следующей реплике
                onToast && onToast('Устройство применится к следующей реплике', 'success');
              }}
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[13px]"
            >
              <option value="">По умолчанию (из настроек ОС, C-06)</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Микрофон ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11.5px] text-mute">
            Смена применяется без перезапуска (C-03): к следующей реплике возьмётся выбранное устройство.
          </p>
        </div>
      )}
    </div>
  );
}
