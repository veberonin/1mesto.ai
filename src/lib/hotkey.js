// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Горячие клавиши: парсинг/нормализация/валидация строк-акселераторов и
 * сопоставление их с DOM-событиями. Используется в UI (переназначение),
 * в App (веб-хоткей) и в electron/main (глобальный хоткей).
 * Канонический вид: «Alt+Space», «Ctrl+Shift+K», «F5».
 */

export const DEFAULT_HOTKEY = 'Alt+Space';

const MOD_ALIASES = {
  CTRL: 'ctrl',
  CONTROL: 'ctrl',
  CMDORCTRL: 'ctrl',
  COMMANDORCONTROL: 'ctrl',
  ALT: 'alt',
  OPTION: 'alt',
  SHIFT: 'shift',
  META: 'meta',
  SUPER: 'meta',
  WIN: 'meta',
  CMD: 'meta',
  COMMAND: 'meta',
};

const NAMED_KEYS = new Set([
  'Space',
  'Tab',
  'Enter',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Comma',
  'Period',
  'Slash',
  'Semicolon',
  'Quote',
  'Backquote',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Backslash',
]);

// 'PAGEUP' → 'PageUp', 'COMMA' → 'Comma', …
const NAMED_BY_UPPER = {};
for (const k of NAMED_KEYS) NAMED_BY_UPPER[k.toUpperCase()] = k;

/** Строка-акселератор → { ctrl, alt, shift, meta, key } | null */
export function parseHotkey(input) {
  if (!input || typeof input !== 'string') return null;
  const parts = input
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const acc = { ctrl: false, alt: false, shift: false, meta: false, key: null };
  for (let i = 0; i < parts.length; i++) {
    const up = parts[i].toUpperCase();
    if (MOD_ALIASES[up]) {
      if (acc[MOD_ALIASES[up]]) return null; // модификатор продублирован
      acc[MOD_ALIASES[up]] = true;
      continue;
    }
    if (i !== parts.length - 1) return null; // клавиша должна быть последней
    const key = canonicalKey(up);
    if (!key) return null;
    acc.key = key;
  }
  if (!acc.key) return null;
  return acc;
}

function canonicalKey(up) {
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(up)) return up; // F1..F24
  if (NAMED_BY_UPPER[up]) return NAMED_BY_UPPER[up]; // SPACE → Space, PAGEUP → PageUp
  if (/^[A-Z]$/.test(up)) return up; // канонические буквы: A..Z
  if (/^[0-9]$/.test(up)) return up; // канонические цифры: 0..9
  if (/^DIGIT[0-9]$/.test(up)) return up.slice(5); // Digit5 → '5'
  if (/^KEY[A-Z]$/.test(up)) return up.slice(3); // KeyK → 'K'
  return null;
}

/** Каноническая строка или null */
export function normalizeAccelerator(input) {
  const acc = parseHotkey(input);
  if (!acc) return null;
  const mods = [];
  if (acc.ctrl) mods.push('Ctrl');
  if (acc.alt) mods.push('Alt');
  if (acc.shift) mods.push('Shift');
  if (acc.meta) mods.push('Meta');
  mods.push(acc.key);
  return mods.join('+');
}

/** Валиден ли для регистрации: нужен модификатор либо F-клавиша */
export function isValidAccelerator(input) {
  const acc = parseHotkey(input);
  if (!acc) return false;
  if (acc.ctrl || acc.alt || acc.meta) return true;
  return /^F([1-9]|1[0-9]|2[0-4])$/.test(acc.key); // Shift+X без системного модификатора нельзя, F5 — можно
}

/** Строка для electron globalShortcut (Meta → Super) */
export function toElectronAccelerator(input) {
  const acc = parseHotkey(input);
  if (!acc) return null;
  const mods = [];
  if (acc.ctrl) mods.push('Control');
  if (acc.alt) mods.push('Alt');
  if (acc.shift) mods.push('Shift');
  if (acc.meta) mods.push('Super');
  mods.push(acc.key);
  return mods.join('+');
}

/** DOM-событие → каноническая строка (для поля «нажми комбинацию») */
export function hotkeyFromEvent(e) {
  const acc = {
    ctrl: !!e.ctrlKey,
    alt: !!e.altKey,
    shift: !!e.shiftKey,
    meta: !!e.metaKey,
    key: null,
  };
  acc.key = codeToKey(e.code);
  if (!acc.key) return null;
  const mods = [];
  if (acc.ctrl) mods.push('Ctrl');
  if (acc.alt) mods.push('Alt');
  if (acc.shift) mods.push('Shift');
  if (acc.meta) mods.push('Meta');
  mods.push(acc.key);
  return mods.join('+');
}

function codeToKey(code) {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return NAMED_BY_UPPER[code.toUpperCase()] || null;
}

/** Совпадает ли событие с назначенным хоткеем (точное соответствие модификаторов) */
export function hotkeyMatches(e, accelerator) {
  const acc = parseHotkey(accelerator);
  if (!acc) return false;
  const key = codeToKey(e.code);
  if (key !== acc.key) return false;
  return (
    !!e.ctrlKey === acc.ctrl &&
    !!e.altKey === acc.alt &&
    !!e.shiftKey === acc.shift &&
    !!e.metaKey === acc.meta
  );
}
