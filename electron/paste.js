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

// ВВОД БУКВ (KEYEVENTF_UNICODE): текст «печатается» в активное окно напрямую,
// минуя буфер и Ctrl+V. Работает там, где клавиатурная инъекция Ctrl+V глушится
// (антивирус/политики/фокус-тайминг). Самый детерминированный путь для диктовки.
const WIN_TYPE_PS = `
$sig = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FlowType {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public KI U; }
  [StructLayout(LayoutKind.Explicit)] public struct KI { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extra; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] i, int size);
  static INPUT Uni(char c, uint flags) {
    return new INPUT { type = 1, U = new KI { ki = new KEYBDINPUT { wVk = 0, wScan = (ushort)c, dwFlags = flags } } };
  }
  static INPUT Key(ushort vk, bool up) {
    return new INPUT { type = 1, U = new KI { ki = new KEYBDINPUT { wVk = vk, dwFlags = up ? 2u : 0u } } };
  }
  public static void TypeText(string path) {
    string t = System.IO.File.ReadAllText(path, Encoding.UTF8);
    var list = new System.Collections.Generic.List<INPUT>(t.Length * 2 + 8);
    foreach (char c in t) {
      if (c == '\r') continue;
      if (c == '\n') { list.Add(Key(0x0D, false)); list.Add(Key(0x0D, true)); continue; }
      if (c == '\0') continue;
      list.Add(Uni(c, 0x0004)); // KEYEVENTF_UNICODE
      list.Add(Uni(c, 0x0006)); // KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
    }
    if (list.Count == 0) return;
    var arr = list.ToArray();
    uint sent = SendInput((uint)arr.Length, arr, Marshal.SizeOf(typeof(INPUT)));
    if (sent != arr.Length) throw new Exception("SendInput sent " + sent + "/" + arr.Length);
  }
}
'@
Add-Type -TypeDefinition $sig -Language CSharp
[FlowType]::TypeText('__TEXT_FILE__')
`;

/** Команда посимвольного ввода текста из UTF-8 файла (главный путь win32) */
export function pickTypeCommand(textFilePath) {
  if (process.platform !== 'win32') return null;
  const safe = String(textFilePath).replace(/'/g, "''");
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
      WIN_TYPE_PS.replace('__TEXT_FILE__', safe),
    ],
    timeoutMs: 12000,
  };
}
