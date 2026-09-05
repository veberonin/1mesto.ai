// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Как вставить текст в ПРЕДЫДУЩЕ фокусированное приложение (то, где стоял курсор).
 * Возвращает команду для main-процесса Electron. Чистая функция — покрыта тестами.
 */
export function pickPasteCommand(platform) {
  if (platform === 'darwin') {
    // Требует разрешения Accessibility (Системные настройки → Конфиденциальность)
    return {
      cmd: 'osascript',
      args: ['-e', 'tell application "System Events" to keystroke "v" using command down'],
      timeoutMs: 4000,
    };
  }
  if (platform === 'win32') {
    // SendKeys через WScript.Shell — работает из коробки
    return {
      cmd: 'powershell.exe',
      args: [
        '-NoProfile',
        '-WindowStyle',
        'Hidden',
        '-Command',
        "(New-Object -ComObject WScript.Shell).SendKeys('^v')",
      ],
      timeoutMs: 4000,
    };
  }
  if (platform === 'linux') {
    // X11: xdotool. Wayland: может не сработать — тогда остаётся буфер обмена
    return { cmd: 'xdotool', args: ['key', '--clearmodifiers', 'ctrl+v'], timeoutMs: 4000 };
  }
  return { cmd: null, args: [], timeoutMs: 0 };
}
