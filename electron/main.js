// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, session, screen, nativeImage } from 'electron';
import path from 'path';
import crypto from 'crypto';
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
  whisperBin: '',   // путь к whisper-cli (локальное распознавание, офлайн)
  whisperModel: '', // путь к ggml-модели (пусто = наша скачанная)
  onboarded: false, // B-01: первый запуск
};

// Локальная модель Whisper: скачивается приложением, проверяется по SHA-256 (A-08/A-09)
const MODEL = {
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
  sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
  file: 'ggml-base-q5_1.bin',
};
const modelsDir = () => path.join(app.getPath('userData'), 'models');
const defaultModelPath = () => path.join(modelsDir(), MODEL.file);

function sha256File(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(p)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

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
// Локальное распознавание речи (ASR): whisper.cpp → Gemini → понятная ошибка
// ---------------------------------------------------------------------------
async function transcribeWhisper(wavPath, lang) {
  const s = readSettings();
  const bin = s.whisperBin || process.env.WHISPER_BIN || '';
  let model = s.whisperModel || process.env.WHISPER_MODEL || '';
  if (!model && fs.existsSync(defaultModelPath())) model = defaultModelPath();
  if (!bin || !model) return null;

  return new Promise((resolve) => {
    execFile(bin, ['-m', model, '-l', lang, '-nt', wavPath], { timeout: 300000 }, (err, stdout) => {
      if (err) {
        console.error('whisper failed:', err.message);
        return resolve(null);
      }
      const text = String(stdout || '')
        .split('\n')
        .filter((l) => l.trim() && !/^\s*\[|^\s*system_info|whisper_/i.test(l))
        .join(' ')
        .trim();
      resolve(text || null);
    });
  });
}

async function transcribeGeminiBytes(bytes, lang) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const b64 = Buffer.from(bytes).toString('base64');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `Транскрибируй речь дословно на ${lang === 'en' ? 'английском' : 'русском'}. Только текст.` },
              { inlineData: { mimeType: 'audio/wav', data: b64 } },
            ],
          },
        ],
      }),
    }
  );
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return out ? out.trim() : null;
}

ipcMain.handle('asr:transcribe', async (_e, bytes, lang = 'ru') => {
  const tmp = path.join(app.getPath('temp'), `flow-${Date.now()}.wav`);
  try {
    fs.writeFileSync(tmp, Buffer.from(bytes));
    let text = await transcribeWhisper(tmp, lang);
    if (text) return { text, source: 'whisper' };
    text = await transcribeGeminiBytes(bytes, lang);
    if (text) return { text, source: 'gemini' };
    return {
      text: '',
      error: 'no-engine',
      hint: 'Установи whisper.cpp (Settings → Распознавание) или задай GEMINI_API_KEY',
    };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* P-10 */ }
  }
});

ipcMain.handle('asr:download-model', async () => {
  fs.mkdirSync(modelsDir(), { recursive: true });
  const dest = defaultModelPath();
  if (fs.existsSync(dest)) {
    const hash = await sha256File(dest);
    if (hash === MODEL.sha256) return { ok: true, existing: true, path: dest };
  }
  const res = await fetch(MODEL.url);
  if (!res.ok) throw new Error(`HF ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  const hash = await sha256File(dest);
  if (hash !== MODEL.sha256) {
    fs.unlinkSync(dest);
    throw new Error(`SHA-256 mismatch: ${hash}`);
  }
  return { ok: true, path: dest, sha256: hash };
});

ipcMain.handle('asr:check', async () => {
  const s = readSettings();
  const bin = s.whisperBin || process.env.WHISPER_BIN || '';
  const model = s.whisperModel || process.env.WHISPER_MODEL || (fs.existsSync(defaultModelPath()) ? defaultModelPath() : '');
  return {
    platform: process.platform,
    whisperBin: !!bin && fs.existsSync(bin),
    whisperModel: !!model && fs.existsSync(model),
    modelDownloaded: fs.existsSync(defaultModelPath()),
    modelPath: defaultModelPath(),
    geminiKey: !!process.env.GEMINI_API_KEY,
  };
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
