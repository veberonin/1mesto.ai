// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * «Аудио в текст»: готовый звуковой файл (лекция, войс, интервью) → текст.
 * Путь тот же, что у диктовки: локальный whisper.cpp → Gemini (фолбэк).
 * Результат: вставить в активное приложение (Ctrl+V из буфера) или скопировать.
 */
import React, { useRef, useState } from 'react';
import { FileAudio, ClipboardPaste, Copy, Loader2, CheckCircle2 } from 'lucide-react';
import { isDesktop, desktopAPI } from '../lib/desktop.js';

/** Копирование в буфер: Clipboard API → execCommand-фолбэк (как в App) */
const copyText = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(ta);
  }
};

export default function AudioTab({ onToast, onInsert }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [inserted, setInserted] = useState(false);
  const inputRef = useRef(null);

  const pick = async () => {
    if (!isDesktop()) {
      onToast('Загрузка файла работает в приложении (десктоп)', 'info');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (f) {
        setFile(f);
        setResult(null);
        setInserted(false);
      }
    };
    input.click();
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setInserted(false);
    try {
      // Electron показывает путь только в file.path (webUtils устар.) — используем
      // FileReader → временный файл в userData не нужен: main принимает ПУТЬ.
      const pathFromFile = file.path || (inputRef.current && inputRef.current.value);
      if (!pathFromFile) {
        onToast('Не удалось получить путь файла — выбери его заново', 'error');
        setBusy(false);
        return;
      }
      const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
      const r = await desktopAPI.transcribeFile(pathFromFile, lang);
      if (r && r.text) {
        setResult(r);
        onToast(`Готово (${r.source}) ✓`, 'success');
      } else {
        onToast(r?.error || 'Не удалось распознать файл', 'error');
      }
    } catch (e) {
      onToast('Сбой: ' + (e.message || 'неизвестно'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const insertIntoApp = async () => {
    if (!result) return;
    try {
      const r = await desktopAPI.insertText(result.text);
      setInserted(true);
      onToast(
        r && r.method === 'clipboard-only'
          ? 'Скопировано — жми Ctrl+V в нужном приложении'
          : 'Вставлено в активное приложение ✓',
        'success'
      );
    } catch {
      copyText(result.text);
      onToast('Скопировано в буфер ✓', 'success');
    }
    if (onInsert) onInsert(result.text);
  };

  const copyResult = () => {
    if (!result) return;
    copyText(result.text);
    onToast('Скопировано ✓', 'success');
  };

  return (
    <div className="pt-2 space-y-6 max-w-3xl">
      <div className="rounded-3xl glass p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <FileAudio className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-black">Аудио в текст</h2>
        </div>
        <p className="text-[13px] text-mute leading-relaxed">
          Готовый звук — лекция, войс, интервью — переписываем в текст. Распознавание локальное (whisper внутри
          приложения, офлайн), результат можно вставить в любой редактор курсором.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={pick}
            className="px-4 py-2.5 rounded-xl text-[12.5px] font-bold border border-line bg-card hover:border-accent"
          >
            {file ? 'Выбрать другой файл' : 'Выбрать аудиофайл'}
          </button>
          <button
            onClick={run}
            disabled={!file || busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-bold bg-ink text-paper disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileAudio className="w-4 h-4" />}
            {busy ? 'Распознаю… (длинный файл — подожди)' : 'Переписать в текст'}
          </button>
          {file && <span className="text-[12px] text-mute truncate max-w-[320px]">{file.name}</span>}
        </div>
      </div>

      {result && (
        <div className="rounded-3xl glass p-6 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <h3 className="font-bold">Результат ({result.source === 'gemini' ? 'Gemini' : 'whisper офлайн'})</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={insertIntoApp}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold bg-ink text-paper"
              >
                <ClipboardPaste className="w-4 h-4" />
                Вставить в приложение
              </button>
              <button
                onClick={copyResult}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12.5px] font-bold border border-line bg-card"
              >
                <Copy className="w-3.5 h-3.5" />
                Копировать
              </button>
            </div>
          </div>
          <div className="rounded-2xl bg-paper/70 border border-line px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {result.text}
          </div>
          {inserted && (
            <p className="text-[11px] text-mute mt-2">Курсор был в редакторе? Текст уже там. Иначе — он в буфере.</p>
          )}
        </div>
      )}
    </div>
  );
}
