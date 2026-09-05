// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * «Проверка вслух» (оригинальная фича, AK): после вставки приложение само
 * перечитывает результат системным голосом (speechSynthesis) — удобно
 * проверять текст не отрывая рук. Работает офлайн (системные голоса),
 * выключается настройкой, на базовый сценарий диктовки не влияет.
 */

export function voiceCheckAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Прочитать текст вслух. Возвращает true, если запуск состоялся.
 * Никогда не бросает: фича не должна ломать основной сценарий (AK-07).
 */
export function speakText(text, lang = 'ru') {
  try {
    if (!voiceCheckAvailable() || !text) return false;
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 600));
    u.lang = lang === 'en' ? 'en-US' : 'ru-RU';
    u.rate = 1.05;
    window.speechSynthesis.cancel(); // не копим очередь
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    if (voiceCheckAvailable()) window.speechSynthesis.cancel();
  } catch {
    /* AK-07: фича инертна при любой ошибке */
  }
}
