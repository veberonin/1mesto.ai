// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react';

/** Разбивает акселератор «Ctrl+Shift+K» на части для кейкапов */
export function hotkeyParts(hotkey) {
  const raw = typeof hotkey === 'string' && hotkey.trim() ? hotkey.trim() : 'Alt+Space';
  return raw.split('+').map((p) => p.trim()).filter(Boolean);
}

/**
 * Кейкапы текущего хоткея — единая точка правды для всех подсказок.
 * <Keycaps hotkey={settings.hotkey} /> или тёмный вариант на баннере: dark.
 */
export default function Keycaps({ hotkey, dark = false, className = '' }) {
  const base = dark
    ? 'keycap !border-paper/60 !bg-white/10 !text-paper !shadow-none'
    : 'keycap';
  return (
    <>
      {hotkeyParts(hotkey).map((part, i) => (
        <span key={`${part}-${i}`} className={`${base} ${className}`}>
          {part}
        </span>
      ))}
    </>
  );
}
