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
    // SendInput (WinAPI) — не создаёт видимого окна и не крадёт фокус,
    // в отличие от WScript.Shell SendKeys, который на Win11 ненадёжен
    return {
      cmd: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        WIN_SENDINPUT_PS,
      ],
      timeoutMs: 8000,
    };
  }
  if (platform === 'linux') {
    // X11: xdotool. Wayland: может не сработать — тогда остаётся буфер обмена
    return { cmd: 'xdotool', args: ['key', '--clearmodifiers', 'ctrl+v'], timeoutMs: 4000 };
  }
  return { cmd: null, args: [], timeoutMs: 0 };
}

// PowerShell + Add-Type: прямая инъекция Ctrl+V через user32!SendInput.
// В12-безопасно: вставляется ТО, что юзер сам продиктовал, в его активное окно.
const WIN_SENDINPUT_PS = `
$sig = @'
using System;
using System.Runtime.InteropServices;
public static class FlowKeys {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public KI U; }
  [StructLayout(LayoutKind.Explicit)] public struct KI { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extra; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] i, int size);
  public static void CtrlV() {
    var a = new INPUT[4];
    a[0].type = 1; a[0].U.ki.wVk = 0x11;
    a[1].type = 1; a[1].U.ki.wVk = 0x56;
    a[2].type = 1; a[2].U.ki.wVk = 0x56; a[2].U.ki.dwFlags = 2;
    a[3].type = 1; a[3].U.ki.wVk = 0x11; a[3].U.ki.dwFlags = 2;
    SendInput(4, a, Marshal.SizeOf(typeof(INPUT)));
  }
}
'@
Add-Type -TypeDefinition $sig -Language CSharp
[FlowKeys]::CtrlV()
`;

// Тёплый хост вставки: PowerShell стартует 0.5–1с — за это время фокус целевого
// приложения (Telegram, браузеры) «уплывает», и Ctrl+V уходит мимо. Держим ОДИН
// скрытый процесс с уже загруженным SendInput: вставка за ~30 мс, как у оригинала.
const WIN_HOST_PS = `
$sig = @'
${'{'}same-sig{'}'}
'@
`
  .replace('{same-sig}', WIN_SENDINPUT_PS.match(/@'\n([\s\S]*?)'@/)[1])
  .replace(
    /Add-Type[\s\S]*$/,
    `
Add-Type -TypeDefinition $sig -Language CSharp
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  [FlowKeys]::CtrlV()
  [Console]::Out.WriteLine('OK')
}
`
  );

import { spawn } from 'node:child_process';

let warmHost = null;
/** Живой хост: { proc, pending } | null. Умер — пересоздадим при следующем запросе. */
function ensureWarmHost() {
  if (warmHost && warmHost.proc && warmHost.proc.exitCode === null && !warmHost.proc.killed) return warmHost;
  if (process.platform !== 'win32') return null;
  try {
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_HOST_PS], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const state = { proc, pending: [], buf: '' };
    proc.stdout.on('data', (d) => {
      state.buf += String(d);
      while (state.buf.includes('OK')) {
        state.buf = state.buf.replace('OK', '');
        const r = state.pending.shift();
        if (r) r(true);
      }
    });
    proc.on('exit', () => {
      warmHost = null;
      for (const r of state.pending.splice(0)) r(false);
    });
    warmHost = state;
    return state;
  } catch {
    return null;
  }
}

/** Прогрев при старте приложения: компиляция Add-Type в фоне (~1с, один раз) */
export function warmUpPaste() {
  ensureWarmHost();
}

/** Ctrl+V через тёплый хост. false = хост не ответил (фолбэк на холодный запуск). */
export function warmCtrlV() {
  const h = ensureWarmHost();
  if (!h) return Promise.resolve(false);
  return new Promise((resolve) => {
    h.pending.push(resolve);
    try {
      h.proc.stdin.write('v\n');
    } catch {
      const i = h.pending.indexOf(resolve);
      if (i >= 0) h.pending.splice(i, 1);
      resolve(false);
    }
    setTimeout(() => {
      const i = h.pending.indexOf(resolve);
      if (i >= 0) {
        h.pending.splice(i, 1);
        resolve(false);
      }
    }, 2500);
  });
}
