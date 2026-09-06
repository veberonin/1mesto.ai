// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import {
  Wand2,
  User,
  Volume2,
  Keyboard,
  Server,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Cpu,
  Download,
  RefreshCw,
  BookA,
  Upload,
  FileDown,
  Moon,
  Power,
  Languages,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { isDesktop, desktopAPI } from '../lib/desktop.js';
import { parsePairsText, mergeIntoText, DICT_TEMPLATE } from '../lib/dictio.js';
import { exportProfile, importProfile } from '../lib/profile.js';
import MicCard from './MicCard.jsx';
import { enableJournalEncryption, disableJournalEncryption, isJournalEncrypted } from '../lib/journal.js';
import { normalizeAccelerator, hotkeyFromEvent, isValidAccelerator, DEFAULT_HOTKEY } from '../lib/hotkey.js';

function Toggle({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{label}</div>
        {desc && <div className="text-[11.5px] text-mute mt-0.5">{desc}</div>}
      </div>
      <button className="switch" data-on={!!value} onClick={() => onChange(!value)} aria-label={label}>
        <span />
      </button>
    </div>
  );
}

const PROVIDERS = [
  { id: 'none', name: 'Без AI', desc: 'Только локальный умный форматер — работает офлайн' },
  { id: 'ollama', name: 'Ollama', desc: 'Локальная LLM на твоём компе — бесплатно и приватно' },
  { id: 'gemini', name: 'Google Gemini', desc: 'gemini-1.5-flash — быстрый и бесплатный по квоте' },
  { id: 'openai', name: 'OpenAI', desc: 'gpt-4o-mini — дороговато, но блестяще' },
];

const inputCls =
  'w-full bg-paper/70 border border-line rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-accent';

export default function SettingsTab({
  settings,
  onChange,
  serverOnline,
  onCheckServer,
  onResetStats,
  onResetSettings,
  onToast,
}) {
  const [showKey, setShowKey] = useState(false);
  const profileRef = useRef(null);

  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* AI */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-accent" />
          <h3 className="font-bold">AI-полировка текста</h3>
        </div>
        <p className="text-[12px] text-mute mb-4">
          Локальный форматер уже убирает паразитов и ставит пунктуацию. Внешний AI добавит глубину: перепишет
          корявые фразы и подгонит тон.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => set({ provider: p.id })}
              className={`p-3.5 rounded-2xl text-left border transition-all ${
                settings.provider === p.id
                  ? 'border-accent/50 bg-accent-soft shadow-sm'
                  : 'border-line bg-card hover:border-mute/40'
              }`}
            >
              <div className="text-[13px] font-bold">{p.name}</div>
              <div className="text-[10.5px] text-mute mt-0.5 leading-snug">{p.desc}</div>
            </button>
          ))}
        </div>

        {settings.provider === 'ollama' && (
          <div className="p-3.5 rounded-2xl border border-accent/20 bg-accent-soft/60 text-[12px] text-ink-800 leading-relaxed">
            <b>Ollama локально.</b> Запусти{' '}
            <code className="px-1 py-0.5 rounded bg-ink/5 font-mono">ollama serve</code> и скачай модель:{' '}
            <code className="px-1 py-0.5 rounded bg-ink/5 font-mono">ollama pull llama3.1</code>. Сервер сам
            найдёт Ollama на <code className="px-1 py-0.5 rounded bg-ink/5 font-mono">localhost:11434</code>.
            Ключ не нужен.
          </div>
        )}

        {settings.provider !== 'none' && settings.provider !== 'ollama' && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
              API-ключ ({settings.provider === 'gemini' ? 'Google AI Studio' : 'OpenAI'})
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey || ''}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder={settings.provider === 'gemini' ? 'AIza…' : 'sk-…'}
                className={inputCls + ' pr-11 font-mono'}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-mute mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Ключ хранится только у тебя на компьютере и уходит лишь провайдеру.
            </p>
          </div>
        )}
      </div>

      {/* Распознавание речи (локальное) */}
      <AsrCard settings={settings} onChange={set} onToast={onToast} />

      {/* Словарь и макросы + импорт из файла (H-01) */}
      <DictCard settings={settings} onChange={set} onToast={onToast} />

      {/* Язык распознавания */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Languages className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Язык распознавания</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'auto', label: 'Авто', desc: 'определяется сам' },
            { id: 'ru', label: 'Русский', desc: 'ru-RU' },
            { id: 'en', label: 'English', desc: 'en-US' },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => set({ language: l.id })}
              className={`p-3.5 rounded-2xl text-left border transition-all ${
                (settings.language || 'ru') === l.id
                  ? 'border-accent/50 bg-accent-soft'
                  : 'border-line bg-card hover:border-mute/40'
              }`}
            >
              <div className="text-[13px] font-bold">{l.label}</div>
              <div className="text-[10.5px] text-mute mt-0.5">{l.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-mute mt-2">
          В «Авто» язык определяет распознаватель (whisper/Gemini). Пилюля и дашборд используют одну
          настройку.
        </p>
      </div>

      {/* Поведение */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Поведение</h3>
        </div>
        <div className="divide-y divide-line/70">
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
          <Toggle
            label="Автопунктуация"
            desc="Точки, запятые и заглавные ставятся сами (G-16: можно выключить)"
            value={settings.autoPunct !== false}
            onChange={(v) => set({ autoPunct: v })}
          />
          <Toggle
            label="Числа цифрами"
            desc="«пять тысяч» → 5000 (F-10)"
            value={settings.normalizeNumbers !== false}
            onChange={(v) => set({ normalizeNumbers: v })}
          />
          <Toggle
            label="Голосовые команды"
            desc="«запятая», «точка», «новый абзац», «тире» превращаются в знаки"
            value={settings.voiceCommands !== false}
            onChange={(v) => set({ voiceCommands: v })}
          />
          <Toggle
            label="Буква «ё»"
            desc="Восстанавливать ё там, где она всегда: «еще» → «ещё»"
            value={!!settings.restoreYo}
            onChange={(v) => set({ restoreYo: v })}
          />
          <Toggle
            label="Проверка вслух"
            desc="После вставки перечитать результат системным голосом — проверка без рук"
            value={!!settings.voiceCheck}
            onChange={(v) => set({ voiceCheck: v })}
          />
          <Toggle
            label="Шумоподавление"
            desc="Фильтр шума браузера/ОС на входе — выключи, если глотаешь согласные (C-16)"
            value={settings.noiseSuppression !== false}
            onChange={(v) => set({ noiseSuppression: v })}
          />
          <Toggle
            label="Приватный режим"
            desc="История ведётся без текста реплик — только метрики (P-12/T-10)"
            value={!!settings.privacy}
            onChange={(v) => set({ privacy: v })}
          />
          <M17Card onToast={onToast} />
        </div>
      </div>

      {/* Персонализация */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Персонализация</h3>
        </div>
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
          Подпись в email-режиме
        </label>
        <input
          value={settings.name || ''}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Например: Веберонин"
          className={inputCls}
        />
      </div>

      {/* Сервер и данные */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold">Сервер и данные</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCheckServer}
            className={`px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border transition-colors ${
              serverOnline
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
                : 'border-line bg-card text-ink-800 hover:border-mute/40'
            }`}
          >
            {serverOnline ? '● Сервер подключён' : '○ Проверить сервер'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Сбросить всю статистику?')) onResetStats();
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-red-500/30 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Очистить данные
          </button>
        </div>
        <p className="text-[11.5px] text-mute mt-3">
          Статистика хранится локально, а при живом бэкенде ещё и зеркалится на сервер (Express + JSON).
        </p>
      </div>

      {/* Профиль настроек: экспорт/импорт/сброс (B-15/B-07) */}
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Профиль настроек</h3>
        </div>
        <p className="text-[12px] text-mute mb-3">
          Перенос конфигурации между машинами одним файлом. API-ключи в профиль не попадают.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              try {
                const blob = new Blob([exportProfile(settings)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'flow-profile.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                onToast('Профиль выгружен ✓', 'success');
              } catch {
                onToast('Не удалось выгрузить профиль', 'error');
              }
            }}
            className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line bg-card hover:border-accent"
          >
            Экспортировать профиль
          </button>
          <input
            ref={profileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              try {
                const { values, errors } = importProfile(await f.text());
                const n = Object.keys(values).length;
                if (!n) {
                  onToast('В файле нет известных настроек', 'error');
                } else {
                  onChange({ ...settings, ...values });
                  onToast(
                    `Профиль применён: ${n} настроек${errors.length ? ` (пропущено: ${errors.length})` : ''}`,
                    'success'
                  );
                }
              } catch {
                onToast('Не удалось прочитать файл профиля', 'error');
              } finally {
                if (profileRef.current) profileRef.current.value = '';
              }
            }}
          />
          <button
            onClick={() => profileRef.current && profileRef.current.click()}
            className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line bg-card hover:border-accent"
          >
            Импортировать профиль
          </button>
          <button
            onClick={() => {
              if (window.confirm('Сбросить все настройки к значениям по умолчанию?')) onResetSettings();
            }}
            className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line text-mute hover:text-red-600"
          >
            Сбросить настройки
          </button>
        </div>
      </div>

      {/* Горячие клавиши (переназначаемые) */}
      <HotkeyCard settings={settings} onChange={set} onToast={onToast} />

      {/* Микрофон: список устройств, выбор, смена на лету (C-01..C-06) */}
      <MicCard settings={settings} onChange={onChange} onToast={onToast} />

      {/* Фоновый режим (десктоп) */}
      <BackgroundCard settings={settings} onChange={set} onToast={onToast} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Словарь замен + макросы + импорт из файла (H-01)                    */
/* ------------------------------------------------------------------ */
function DictCard({ settings, onChange, onToast }) {
  const fileRef = useRef(null);
  const dictText = settings.dictText || '';
  const macrosText = settings.macrosText || '';
  const parsed = parsePairsText(`${dictText}\n${macrosText}`);
  const total = Object.keys(parsed.dict).length + Object.keys(parsed.macros).length;

  const downloadTemplate = () => {
    try {
      const blob = new Blob([DICT_TEMPLATE], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'flow-dict-template.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      onToast('Шаблон скачан ✓', 'success');
    } catch {
      onToast('Не удалось скачать шаблон', 'error');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const content = await file.text();
      const imported = parsePairsText(content);
      const n = Object.keys(imported.dict).length + Object.keys(imported.macros).length;
      if (!n) {
        onToast('В файле не нашлось замен — сверься с шаблоном', 'error');
        return;
      }
      onChange({
        ...settings,
        dictText: mergeIntoText(dictText, imported),
        macrosText: mergeIntoText(macrosText, imported),
      });
      const bad = imported.errors.length ? ` (неразобранных строк: ${imported.errors.length})` : '';
      onToast(`Импортировано замен: ${n}${bad}`, 'success');
    } catch {
      onToast('Не удалось прочитать файл', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="rounded-3xl glass p-6 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookA className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Словарь и макросы</h3>
          {total > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent-deep text-[10.5px] font-bold">
              {total} активных
            </span>
          )}
        </div>
      </div>
      <p className="text-[12px] text-mute mt-1 mb-4 leading-relaxed">
        Как слышится → как надо писать: термины, бренды, имена. Макросы разворачиваются по имени с решёткой.
        Работает и в дашборде, и в пилюле.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
            Словарь (одна замена в строке)
          </label>
          <textarea
            value={dictText}
            onChange={(e) => onChange({ ...settings, dictText: e.target.value })}
            rows={5}
            spellCheck={false}
            placeholder={'1с = 1С\nбитрикс24 = Битрикс24\nпмо = ПМО'}
            className="w-full bg-paper/70 border border-line rounded-xl px-4 py-3 text-[12.5px] font-mono leading-relaxed focus:outline-none focus:border-accent resize-y"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
            Макросы (#имя = текст)
          </label>
          <textarea
            value={macrosText}
            onChange={(e) => onChange({ ...settings, macrosText: e.target.value })}
            rows={3}
            spellCheck={false}
            placeholder={'#адрес = г. Москва, ул. Тверская, д. 1\n#подпись = С уважением, Иван'}
            className="w-full bg-paper/70 border border-line rounded-xl px-4 py-3 text-[12.5px] font-mono leading-relaxed focus:outline-none focus:border-accent resize-y"
          />
        </div>
        {parsed.errors.length > 0 && (
          <div className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Не разобрал {parsed.errors.length} строк: «{parsed.errors[0].slice(0, 40)}» — нужен формат «слово
            = замена»
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Импорт из файла (H-01): .txt / .csv / .tsv / .json */}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.tsv,.json,text/plain,application/json"
            className="hidden"
            onChange={(e) => handleFile(e.target.files && e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold bg-ink text-paper hover:bg-ink-800"
          >
            <Upload className="w-3.5 h-3.5" /> Импорт из файла
          </button>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border border-line bg-card hover:border-accent"
          >
            <FileDown className="w-3.5 h-3.5" /> Скачать шаблон
          </button>
          <span className="text-[11px] text-mute">.txt · .csv · .tsv · .json</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Локальное распознавание (whisper.cpp)                               */
/* ------------------------------------------------------------------ */
function AsrCard({ settings, onChange, onToast }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    if (!isDesktop()) return;
    desktopAPI
      .asrCheck()
      .then(setInfo)
      .catch(() => {});
  };
  useEffect(() => {
    refresh();
  }, []);

  if (!isDesktop()) {
    return (
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Распознавание речи</h3>
        </div>
        <p className="text-[12.5px] text-mute leading-relaxed">
          В браузере работает встроенное распознавание Chrome (нужен интернет).
          <b> Полностью офлайн-распознавание — в десктоп-приложении</b> (whisper.cpp + модель).
        </p>
      </div>
    );
  }

  const engineLabel =
    info?.whisperBin && info?.whisperModel
      ? 'whisper.cpp ✓ офлайн'
      : info?.whisperBin
        ? 'бинарь есть, не хватает модели'
        : info?.geminiKey
          ? 'Gemini (по ключу, нужен интернет)'
          : 'не настроено';

  return (
    <div className="rounded-3xl glass p-6 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Распознавание речи</h3>
        </div>
        <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-paper text-mute" title="Обновить">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[12px] text-mute mt-1 mb-4 leading-relaxed">
        Локальный движок whisper.cpp работает офлайн и не зависит от блокировок. Статус: <b>{engineLabel}</b>
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
            Путь к whisper-cli (main / whisper-cli)
          </label>
          <input
            value={settings.whisperBin || ''}
            onChange={(e) => onChange({ ...settings, whisperBin: e.target.value })}
            placeholder="C:\whisper\main.exe · /usr/local/bin/whisper-cli"
            className="w-full bg-paper/70 border border-line rounded-xl px-4 py-2.5 text-[12.5px] font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
            ggml-модель (пусто = скачанная)
          </label>
          <input
            value={settings.whisperModel || ''}
            onChange={(e) => onChange({ ...settings, whisperModel: e.target.value })}
            placeholder="C:\whisper\models\ggml-base-q5_1.bin"
            className="w-full bg-paper/70 border border-line rounded-xl px-4 py-2.5 text-[12.5px] font-mono focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute block mb-1.5">
            Ключ Gemini для резервного распознавания (если whisper не настроен)
          </label>
          <input
            type="password"
            value={settings.geminiKey || ''}
            onChange={(e) => onChange({ ...settings, geminiKey: e.target.value })}
            placeholder="AQ.… или AIza… — хранится только у тебя"
            className="w-full bg-paper/70 border border-line rounded-xl px-4 py-2.5 text-[12.5px] font-mono focus:outline-none focus:border-accent"
          />
          <p className="text-[11px] text-mute mt-1">
            {info?.geminiKey
              ? '✓ Резервное распознавание активно'
              : 'Без ключа и без whisper офлайн-распознавание недоступно'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={async () => {
              setBusy(true);
              onToast('Скачиваю модель ~60 МБ…', 'info');
              try {
                const r = await desktopAPI.downloadModel();
                onToast(
                  r.existing ? 'Модель уже на месте ✓' : 'Модель скачана, SHA-256 сходится ✓',
                  'success'
                );
                refresh();
              } catch (e) {
                onToast('Ошибка загрузки: ' + (e.message || 'сеть'), 'error');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold bg-ink text-paper disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            {info?.modelDownloaded ? 'Проверить модель (60 МБ)' : 'Скачать модель (60 МБ)'}
          </button>

          <button
            onClick={async () => {
              setBusy(true);
              onToast('Скачиваю whisper.cpp ~21 МБ с официального релиза…', 'info');
              try {
                const r = await desktopAPI.downloadBin();
                if (r && r.ok) {
                  onToast('whisper установлен, SHA-256 сходится ✓ Полностью офлайн', 'success');
                  refresh();
                } else {
                  onToast(r?.reason || 'Для этой ОС: brew install whisper-cpp', 'info');
                }
              } catch (e) {
                onToast('Ошибка: ' + (e.message || 'сеть'), 'error');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold border border-line bg-card hover:border-accent disabled:opacity-60"
          >
            Установить whisper в 1 клик (~21 МБ)
          </button>
          <span className="text-[11px] text-mute">
            проверяется по SHA-256 ·{' '}
            <a
              className="underline hover:text-ink"
              href="https://github.com/ggml-org/whisper.cpp/releases"
              target="_blank"
              rel="noreferrer"
            >
              скачать whisper.cpp для своей ОС
            </a>
          </span>
        </div>
        {info?.modelDownloaded && (
          <div className="text-[11px] text-mute font-mono truncate">модель: {info.modelPath}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Переназначение горячих клавиш                                       */
/* ------------------------------------------------------------------ */
function HotkeyCard({ settings, onChange, onToast }) {
  const [capturing, setCapturing] = useState(false);
  const [capturingStyle, setCapturingStyle] = useState(false);

  const current = normalizeAccelerator(settings.hotkey) || DEFAULT_HOTKEY;

  const onKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') {
      setCapturing(false);
      return;
    }
    const hk = hotkeyFromEvent(e);
    if (!hk) return; // нажат только модификатор — ждём
    if (!isValidAccelerator(hk)) {
      onToast('Нужен модификатор: Ctrl/Alt/Meta (или F-клавиша)', 'error');
      return;
    }
    if (settings.hotkeyStyle && hk === settings.hotkeyStyle) {
      onToast('Эта комбинация уже занята хоткеем стиля — выбери другую', 'error');
      return;
    }
    onChange({ ...settings, hotkey: hk });
    setCapturing(false);
    onToast(`Хоткей: ${hk} ✓`, 'success');
  };

  const onStyleKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') {
      setCapturingStyle(false);
      return;
    }
    const hk = hotkeyFromEvent(e);
    if (!hk) return;
    if (!isValidAccelerator(hk)) {
      onToast('Нужен модификатор: Ctrl/Alt/Meta (или F-клавиша)', 'error');
      return;
    }
    if (hk === settings.hotkey) {
      onToast('Эта комбинация уже занята главным хоткеем — выбери другую', 'error');
      return;
    }
    onChange({ ...settings, hotkeyStyle: hk });
    setCapturingStyle(false);
    onToast(`Хоткей стиля: ${hk} ✓`, 'success');
  };

  return (
    <div className="rounded-3xl glass p-6 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Keyboard className="w-4 h-4 text-accent" />
        <h3 className="font-bold">Горячие клавиши</h3>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold">Старт / стоп диктовки</div>
          <div className="text-[11.5px] text-mute mt-0.5">
            Глобальная — работает в любом приложении (десктоп) и в окне Flow (браузер)
          </div>
        </div>
        {capturing ? (
          <button
            onKeyDown={onKeyDown}
            autoFocus
            className="px-5 py-2.5 rounded-xl text-[12.5px] font-bold bg-accent text-white animate-pulse"
          >
            Нажми комбинацию… (Esc — отмена)
          </button>
        ) : (
          <button
            onClick={() => setCapturing(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-card hover:border-accent"
            title="Нажми, чтобы переназначить"
          >
            {current.split('+').map((part) => (
              <span key={part} className="keycap">
                {part}
              </span>
            ))}
            <span className="text-[11px] text-mute ml-1">изменить</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-line/70">
        <div>
          <div className="text-[13.5px] font-semibold">Переключение стиля</div>
          <div className="text-[11.5px] text-mute mt-0.5">
            циклом: умная очистка → email → список → чат → код (D-15)
          </div>
        </div>
        {capturingStyle ? (
          <button
            onKeyDown={onStyleKeyDown}
            autoFocus
            className="px-5 py-2.5 rounded-xl text-[12.5px] font-bold bg-accent text-white animate-pulse"
          >
            Нажми комбинацию… (Esc — отмена)
          </button>
        ) : (
          <button
            onClick={() => setCapturingStyle(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-card hover:border-accent"
          >
            {(normalizeAccelerator(settings.hotkeyStyle) || 'Ctrl+Alt+S').split('+').map((part, i) => (
              <span key={`${part}-${i}`} className="keycap">
                {part}
              </span>
            ))}
            <span className="text-[11px] text-mute ml-1">изменить</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-between items-center gap-3 mt-3 pt-3 border-t border-line/70">
        <div>
          <div className="text-[13.5px] font-semibold">Режим активации (AM-01)</div>
          <div className="text-[11.5px] text-mute mt-0.5">
            переключатель: нажал — пишет, нажал — стоп · удержание: держи и говори
            {isDesktop() ? ' (в десктопе глобальный хоткей всегда тогл)' : ''}
          </div>
        </div>
        <div className="flex rounded-xl border border-line overflow-hidden">
          {['toggle', 'hold'].map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...settings, triggerMode: m })}
              className={
                (settings.triggerMode === m ? 'bg-accent text-white' : 'bg-card text-mute') +
                ' px-4 py-2 text-[12px] font-semibold'
              }
            >
              {m === 'toggle' ? 'Переключатель' : 'Удержание'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-line/70">
        <span className="keycap">Esc</span>
        <span className="text-mute text-[13px]">остановить / отменить (неизменяемая)</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Фоновый режим (десктоп)                                             */
/* ------------------------------------------------------------------ */
function BackgroundCard({ settings, onChange, onToast }) {
  const [login, setLogin] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    desktopAPI
      .getLoginItem()
      .then(setLogin)
      .catch(() => {});
  }, []);

  if (!isDesktop()) {
    return (
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <Moon className="w-4 h-4 text-accent" />
          <h3 className="font-bold">Фоновый режим</h3>
        </div>
        <p className="text-[12.5px] text-mute leading-relaxed">
          Работа в фоне, свёрнутый запуск и автостарт — в <b>десктоп-приложении</b>. В браузере Flow активен,
          пока открыта вкладка.
        </p>
      </div>
    );
  }

  const toggleLogin = async () => {
    try {
      const next = await desktopAPI.setLoginItem(!login);
      setLogin(!!next);
      onToast(next ? 'Автозапуск включён ✓' : 'Автозапуск выключен', 'success');
    } catch {
      onToast('Не удалось изменить автозапуск', 'error');
    }
  };

  return (
    <div className="rounded-3xl glass p-6 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <Moon className="w-4 h-4 text-accent" />
        <h3 className="font-bold">Фоновый режим</h3>
      </div>
      <p className="text-[12px] text-mute mb-3">
        Flow живёт в трее: диктовка по хоткею доступна из любого приложения, даже если окно закрыто.
      </p>
      <div className="divide-y divide-line/70">
        <Toggle
          label="Работать в фоне"
          desc="Закроешь окно — Flow остаётся в трее, хоткей работает"
          value={settings.backgroundMode !== false}
          onChange={(v) => onChange({ ...settings, backgroundMode: v })}
        />
        <Toggle
          label="Запускать свёрнутым в трей"
          desc="При старте приложения окно не открывается"
          value={!!settings.startToTray}
          onChange={(v) => onChange({ ...settings, startToTray: v })}
        />
        <Toggle
          label="Автозапуск при входе в систему"
          desc="Flow стартует вместе с Windows/macOS/Linux (B-10 — настройка в settings.json)"
          value={settings.autostart !== false ? !!settings.autostart : false}
          onChange={(v) => onChange({ ...settings, autostart: v })}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* M-17: шифрование журнала по настройке                               */
/* ------------------------------------------------------------------ */
function M17Card({ onToast }) {
  const [on, setOn] = useState(isJournalEncrypted());
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await enableJournalEncryption(pass);
      if (r.ok) {
        setOn(true);
        setPass('');
        onToast('Журнал шифруется (AES-GCM). Не потеряй пароль!', 'success');
      } else {
        onToast(r.reason || 'Не получилось', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const r = await disableJournalEncryption(pass);
      if (r.ok) {
        setOn(false);
        setPass('');
        onToast('Шифрование выключено, журнал расшифрован', 'success');
      } else {
        onToast(r.reason || 'Не получилось', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-card/60 p-4 mt-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold">🔒 Шифровать журнал (M-17)</div>
          <div className="text-[11.5px] text-mute mt-0.5">
            Реплики на диске — AES-GCM-256, пароль нигде не хранится. Без пароля история не читается.
          </div>
        </div>
        <Toggle value={on} onChange={() => {}} />
      </div>
      {!on && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Придумай пароль (от 4 символов)"
            className="flex-1 min-w-[180px] rounded-xl border border-line bg-paper px-3 py-2 text-[13px]"
          />
          <button
            onClick={enable}
            disabled={busy || pass.length < 4}
            className="px-4 py-2 rounded-xl bg-accent text-white text-[12.5px] font-bold disabled:opacity-40"
          >
            Включить шифрование
          </button>
        </div>
      )}
      {on && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Пароль, чтобы расшифровать"
            className="flex-1 min-w-[180px] rounded-xl border border-line bg-paper px-3 py-2 text-[13px]"
          />
          <button
            onClick={disable}
            disabled={busy || !pass}
            className="px-4 py-2 rounded-xl border border-line text-mute text-[12.5px] font-semibold disabled:opacity-40"
          >
            Выключить шифрование
          </button>
        </div>
      )}
    </div>
  );
}
