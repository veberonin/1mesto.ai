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
    uint sent = SendInput(4, a, Marshal.SizeOf(typeof(INPUT)));
    if (sent != 4) throw new Exception("SendInput отклонил клавиши (" + sent + "/4) — имитация ввода заблокирована");
  }
}
'@
Add-Type -TypeDefinition $sig -Language CSharp
[FlowKeys]::CtrlV()
`;

// ВСТАВКА КОМАНДОЙ ОКНА (WM_PASTE = 0x0302): не имитация клавиш, а сообщение
// сфокусированному контролу целевого приложения «возьми из буфера». Антикеyлоггеры
// и UIPI блокируют SendInput, но оконные сообщения — нет. Наш путь для машин,
// где имитация ввода запрещена (насквозь детерминированный).
const WIN_WMPASTE_PS = `
$sig = @'
using System;
using System.Runtime.InteropServices;
public static class FlowPaste {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct GUITHREADINFO {
    public uint cbSize; public uint flags; public IntPtr hwndActive; public IntPtr hwndFocus;
    public IntPtr hwndCapture; public IntPtr hwndMenuOwner; public IntPtr hwndMoveSize;
    public IntPtr hwndCaret; public RECT rcCaret;
  }
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO info);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr w, IntPtr l, uint flags, uint timeout, out UIntPtr result);
  public static void Paste() {
    GUITHREADINFO g = new GUITHREADINFO();
    g.cbSize = (uint)Marshal.SizeOf(typeof(GUITHREADINFO));
    IntPtr target = IntPtr.Zero;
    if (GetGUIThreadInfo(0, ref g) && g.hwndFocus != IntPtr.Zero) target = g.hwndFocus;
    else target = GetForegroundWindow();
    if (target == IntPtr.Zero) throw new Exception("нет активного окна");
    UIntPtr res;
    IntPtr ok = SendMessageTimeout(target, 0x0302, UIntPtr.Zero, IntPtr.Zero, 2, 1000, out res);
    if (ok == IntPtr.Zero) throw new Exception("окно не ответило на WM_PASTE (занято/заблокировано)");
  }
}
'@
Add-Type -TypeDefinition $sig -Language CSharp
[FlowPaste]::Paste()
`;

/** Команда «вставь из буфера» в сфокусированный контрол активного окна */
export function pickWmPasteCommand() {
  if (process.platform !== 'win32') return null;
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
      WIN_WMPASTE_PS,
    ],
    timeoutMs: 8000,
  };
}

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
      // CR=13, LF=10, NUL=0 — только числами: escape-последовательности в
      // JS-шаблоннике превращаются в реальные control-символы (NUL в args,
      // разрыв C#-литералов)
      if (c == 13) continue;
      if (c == 10) {
        list.Add(Key(0x0D, false));
        list.Add(Key(0x0D, true));
        continue;
      }
      if (c == 0) continue;
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
