// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Профиль настроек (B-15): экспорт/импорт в JSON + санитизация (B-06/V-07).
 * Импорт принимает только известные ключи-примитивы — никакой инициализации
 * кода из файла настроек, proto-загрязнение исключено.
 */

/** Белый список переносимых ключей с типом */
const PORTABLE_KEYS = {
  provider: 'string',
  autoFormat: 'bool',
  autoCopy: 'bool',
  soundOn: 'bool',
  name: 'string',
  privacy: 'bool',
  autoPunct: 'bool',
  normalizeNumbers: 'bool',
  voiceCommands: 'bool',
  restoreYo: 'bool',
  voiceCheck: 'bool',
  language: 'string',
  mode: 'string',
  hotkey: 'string',
  hotkeyStyle: 'string',
  hotkeyEnabled: 'bool',
  backgroundMode: 'bool',
  startToTray: 'bool',
  whisperBin: 'string',
  whisperModel: 'string',
  dictText: 'string',
  macrosText: 'string',
  aiTimeoutMs: 'number',
};

/** Экспорт профиля: только переносимая конфигурация, без ключей API */
export function exportProfile(settings = {}) {
  const out = { app: '1mesto Flow', version: 1, exportedAt: new Date().toISOString() };
  for (const [k, type] of Object.entries(PORTABLE_KEYS)) {
    const v = settings[k];
    if (v === undefined || v === null) continue;
    if (type === 'bool') out[k] = !!v;
    else if (type === 'number') out[k] = Number(v) || undefined;
    else out[k] = String(v);
  }
  return JSON.stringify(out, null, 2);
}

/**
 * Импорт профиля из текста JSON → безопасный набор полей.
 * Неизвестные ключи, не-примитивы и «__proto__» отбрасываются (V-07).
 */
export function importProfile(text) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(String(text || '{}'));
  } catch (e) {
    return { values: {}, errors: [`не JSON: ${e.message}`] };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { values: {}, errors: ['ожидался объект настроек'] };
  }
  const values = {};
  for (const [k, type] of Object.entries(PORTABLE_KEYS)) {
    if (!(k in data)) continue;
    const v = data[k];
    if (typeof v === 'object' && v !== null) {
      errors.push(`${k}: ожидался ${type}, получен объект`);
      continue;
    }
    if (type === 'bool') values[k] = !!v;
    else if (type === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) values[k] = n;
      else errors.push(`${k}: не число`);
    } else values[k] = String(v);
  }
  return { values, errors };
}
