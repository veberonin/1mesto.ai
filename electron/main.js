// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, session, screen, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import url from 'url';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

import { pickPasteCommand } from './paste.js';
import { aiFormat } from './ai.js';
import { formatText } from '../src/lib/formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:3000';

let dashboard = null;
let pill = null;
let tray = null;
let quitting = false;
let pendingStart = false;

// ---------------------------------------------------------------------------
// Настройки (общие для дашборда и пилюли) — JSON в userData
// ---------------------------------------------------------------------------
const DEFAULTS = {
  provider: 'none',
  apiKey: '',
  autoFormat: true,
  autoCopy: false,
  soundOn: true,
  name: '',
  language: 'ru',
  mode: 'clean',
  hotkeyEnabled: true,
};

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  } catch (e) {
    console.error('settings write failed:', e.message);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Вставка текста в предыдущее активное приложение (буфер + Ctrl/Cmd+V)
// ---------------------------------------------------------------------------
function pasteIntoFocusedApp() {
  const { cmd, args, timeoutMs } = pickPasteCommand(process.platform);
  if (!cmd) return Promise.resolve({ ok: true, method: 'clipboard-only' });
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs || 4000 }, (err) => {
      if (err) {
        console.error('paste failed:', err.message);
        resolve({ ok: true, method: 'clipboard-only', error: err.message });
      } else {
        resolve({ ok: true, method: 'paste' });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Окна
// ---------------------------------------------------------------------------
const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

function createDashboard() {
  dashboard = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#08080b',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    title: '1mesto Flow',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    dashboard.loadURL(DEV_URL);
    dashboard.webContents.openDevTools({ mode: 'detach' });
  } else {
    dashboard.loadFile(distIndex);
  }

  // Закрытие окна = свернуть в трей (как у настоящих менюшных приложений)
  dashboard.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      dashboard.hide();
    }
  });
  dashboard.on('closed', () => {
    dashboard = null;
  });
}

function showDashboard() {
  if (!dashboard || dashboard.isDestroyed()) createDashboard();
  dashboard.show();
  dashboard.focus();
}

function createPill() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 430;
  const H = 200;

  pill = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + Math.floor((workArea.width - W) / 2),
    y: workArea.y + workArea.height - H - 24,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pill.setAlwaysOnTop(true, 'screen-saver');
  try {
    pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    /* linux может не уметь */
  }

  if (isDev) {
    pill.loadURL(`${DEV_URL}/?pill=1`);
  } else {
    pill.loadFile(distIndex, { search: 'pill=1' });
  }

  pill.on('closed', () => {
    pill = null;
  });
}

function showPill() {
  if (!pill || pill.isDestroyed()) createPill();
  // пересчитываем позицию (мониторы могли меняться)
  const { workArea } = screen.getPrimaryDisplay();
  const [w] = pill.getSize();
  pill.setPosition(workArea.x + Math.floor((workArea.width - w) / 2), workArea.y + workArea.height - 200 - 24);
  pendingStart = true;
  pill.show();
  pill.focus();
}

/** Горячая клавиша: показать пилюлю+старт OR остановить и вставить */
function toggleDictation() {
  if (!pill || pill.isDestroyed() || !pill.isVisible()) {
    showPill();
  } else {
    pill.webContents.send('flow:command', 'stop');
  }
}

// ---------------------------------------------------------------------------
// Трей
// ---------------------------------------------------------------------------
function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray.png');
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath));
  } catch {
    console.error('tray icon failed');
    return;
  }
  tray.setToolTip('1mesto Flow — Alt+Space и говори');

  const menu = Menu.buildFromTemplate([
    { label: 'Открыть 1mesto Flow', click: showDashboard },
    { label: 'Диктовать (Alt+Space)', click: toggleDictation },
    { type: 'separator' },
    {
      label: 'Автозапуск при входе',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showDashboard);
}

// ---------------------------------------------------------------------------
// Горячая клавиша
// ---------------------------------------------------------------------------
function registerHotkey() {
  globalShortcut.unregisterAll();
  const s = readSettings();
  if (s.hotkeyEnabled === false) return;
  try {
    const ok = globalShortcut.register('Alt+Space', toggleDictation);
    if (!ok) console.error('Alt+Space уже занят другой программой');
  } catch (e) {
    console.error('globalShortcut failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('settings:get', () => readSettings());

ipcMain.handle('settings:save', (_e, patch) => {
  const next = writeSettings(patch || {});
  registerHotkey(); // hotkeyEnabled мог измениться
  return next;
});

ipcMain.on('pill:hide', () => {
  if (pill && !pill.isDestroyed()) pill.hide();
});

ipcMain.handle('pill:insert', async (_e, text) => {
  if (typeof text === 'string' && text.trim()) {
    clipboard.writeText(text);
  }
  return pasteIntoFocusedApp();
});

ipcMain.handle('ai:format', async (_e, payload = {}) => {
  const s = readSettings();
  const { text = '', mode = s.mode, language = s.language } = payload;
  const provider = payload.provider && payload.provider !== 'none' ? payload.provider : s.provider !== 'none' ? s.provider : null;

  try {
    if (provider === 'ollama') {
      const out = await aiFormat(text, mode, language, 'ollama', '');
      if (out) return { formattedText: out, source: 'ai' };
    } else if (provider) {
      const key = payload.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      if (key) {
        const out = await aiFormat(text, mode, language, provider, key);
        if (out) return { formattedText: out, source: 'ai' };
      }
    }
  } catch (e) {
    console.error('ai failed:', e.message);
  }

  // локальный умный форматер — всегда
  const local = formatText(text, { mode, lang: language === 'en' ? 'en' : 'ru', name: payload.name || s.name });
  return { formattedText: local.text, meta: local.meta, source: 'local' };
});

// ---------------------------------------------------------------------------
// Жизненный цикл
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showDashboard);

  app.whenReady().then(() => {
    // Разрешаем микрофон для распознавания речи
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      const allowed = ['media', 'audioCapture', 'clipboard-sanitized-write', 'fullscreen', 'notifications', 'clipboard-read'];
      cb(allowed.includes(permission));
    });

    createDashboard();
    createTray();
    registerHotkey();

    app.on('activate', () => {
      if (dashboard && !dashboard.isDestroyed()) dashboard.show();
      else createDashboard();
    });
  });
}

app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
// Не выходим при закрытии окон — живём в трее
app.on('window-all-closed', () => {});
