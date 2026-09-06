// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Статистика: localStorage как источник правды (работает даже без бэкенда),
 * плюс fire-and-forget зеркалирование на сервер, если он доступен.
 */

const KEY = 'flow-stats-v1';

const todayKey = () => new Date().toISOString().slice(0, 10);

export function loadStats() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }
  return { days: {}, history: [], recordWpm: 0, totalWords: 0, totalSeconds: 0, totalSessions: 0 };
}

function persist(stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* noop */
  }
}

export function saveSession({ words, wpm, peakWpm, durSec, mode, lang, mirrorStats = false }) {
  const stats = loadStats();
  const day = todayKey();
  if (!stats.days[day]) stats.days[day] = { words: 0, seconds: 0, sessions: 0 };
  stats.days[day].words += words;
  stats.days[day].seconds += durSec;
  stats.days[day].sessions += 1;

  stats.history.unshift({
    ts: Date.now(),
    words,
    wpm,
    peakWpm,
    durSec,
    mode,
    lang,
  });
  stats.history = stats.history.slice(0, 60);

  stats.recordWpm = Math.max(stats.recordWpm || 0, wpm || 0);
  stats.totalWords = (stats.totalWords || 0) + words;
  stats.totalSeconds = (stats.totalSeconds || 0) + durSec;
  stats.totalSessions = (stats.totalSessions || 0) + 1;

  persist(stats);

  // Зеркалим на сервер ТОЛЬКО при явном согласии пользователя (P-04: телеметрия
  // выключена по умолчанию): без settings.mirrorStats статистика не покидает машину
  try {
    if (!mirrorStats) return stats;
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationSeconds: durSec,
        wordCount: words,
        averageWpm: wpm,
        maxWpm: peakWpm,
        language: lang,
        mode,
      }),
    }).catch(() => {});
  } catch {
    /* noop */
  }

  return stats;
}

export function getToday(stats) {
  return stats.days[todayKey()] || { words: 0, seconds: 0, sessions: 0 };
}

export function resetStats() {
  const empty = { days: {}, history: [], recordWpm: 0, totalWords: 0, totalSeconds: 0, totalSessions: 0 };
  persist(empty);
  return empty;
}

/** Сколько минут печати сэкономлено (печать ~45 wpm, голос ~130 wpm) */
export function minutesSaved(totalWords) {
  const typing = totalWords / 45;
  const voice = totalWords / 130;
  return Math.max(0, typing - voice);
}
