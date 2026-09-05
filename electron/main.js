// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  clipboard,
  session,
  screen,
  nativeImage,
} from 'electron';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

import { pickPasteCommand } from './paste.js';
import { aiFormat } from './ai.js';
import { formatText } from '../src/lib/formatter.js';
import { normalizeAccelerator, toElectronAccelerator, DEFAULT_HOTKEY } from '../src/lib/hotkey.js';
import { sanitizeTranscript } from '../src/lib/asr-guard.js';
import { stripModelTags } from '../src/lib/formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:3000';

let dashboard = null;
let pill = null;
let tray = null;
let quitting = false;

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
  whisperBin: '', // путь к whisper-cli (локальное распознавание, офлайн)
  whisperModel: '', // путь к ggml-модели (пусто = наша скачанная)
  dictText: '', // H-01: словарь замен (текст из файла/textarea)
  macrosText: '', // H-01: макросы (текст из файла/textarea)
  hotkey: 'Alt+Space', // переназначаемый глобальный хоткей
  backgroundMode: true, // закрытие окна = жить в трее
  startToTray: false, // запуск свёрнутым в трей
  geminiKey: '', // ключ Gemini для резервного распознавания (ASR)
  voiceCommands: true, // K: голосовые команды пунктуации («запятая», «новый абзац»…)
  restoreYo: false, // Ё: восстановление «ё» (опция)
  onboarded: false, // B-01: первый запуск
};

/** Ключ Gemini: настройка → env (для ASR и AI) */
function resolveGeminiKey(s = readSettings()) {
  return s.geminiKey || (s.provider === 'gemini' ? s.apiKey : '') || process.env.GEMINI_API_KEY || '';
}

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

/** B-06: некорректное значение → понятное предупреждение + значение по умолчанию */
function sanitizeSettings(next) {
  if (next.hotkey !== undefined && !normalizeAccelerator(next.hotkey)) {
    console.warn(`[settings] некорректный hotkey «${next.hotkey}» — вернул ${DEFAULT_HOTKEY}`);
    next.hotkey = DEFAULT_HOTKEY;
  }
  if (next.hotkeyStyle !== undefined && !normalizeAccelerator(next.hotkeyStyle)) {
    console.warn(
      `[settings] некорректный hotkeyStyle «${next.hotkeyStyle}» — вернул ${DEFAULTS.hotkeyStyle}`
    );
    next.hotkeyStyle = DEFAULTS.hotkeyStyle;
  }
  if (next.aiTimeoutMs !== undefined) {
    const n = Number(next.aiTimeoutMs);
    if (!Number.isFinite(n) || n < 3000 || n > 120000) {
      console.warn(
        `[settings] aiTimeoutMs ${next.aiTimeoutMs} вне 3000..120000 — вернул ${DEFAULTS.aiTimeoutMs}`
      );
      next.aiTimeoutMs = DEFAULTS.aiTimeoutMs;
    }
  }
  if (next.language !== undefined && !['ru', 'en', 'auto'].includes(next.language)) {
    next.language = 'ru';
  }
  return next;
}

function writeSettings(patch) {
  const next = sanitizeSettings({ ...readSettings(), ...(patch || {}) });
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
  const s = readSettings();
  dashboard = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: !s.startToTray, // фоновый запуск: окно свёрнуто в трей
    backgroundColor: '#F5F2EB', // светлый фон — тёмный «экран смерти» больше не появится
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

  // Закрытие окна = свернуть в трей (если включён фоновый режим)
  dashboard.on('close', (e) => {
    if (!quitting && readSettings().backgroundMode !== false) {
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
  pill.setPosition(
    workArea.x + Math.floor((workArea.width - w) / 2),
    workArea.y + workArea.height - 200 - 24
  );
  pill.show();
  pill.focus();
  // каждое появление = новая диктовка: рендерер сбросит состояние и начнёт запись
  pill.webContents.send('flow:command', 'start');
}

/**
 * Горячая клавиша — детерминированный тогл БЕЗ состояний:
 * скрыта → показать + начать запись; видна → остановить, спрятать сразу,
 * вставка доработает в скрытом окне (фокус вернётся к приложению юзера).
 */
function toggleDictation() {
  if (!pill || pill.isDestroyed()) createPill();
  if (!pill.isVisible()) {
    showPill(); // шлёт 'start' — рендерер начинает запись с чистого листа
  } else {
    pill.webContents.send('flow:command', 'stop');
    pill.hide(); // мгновенно: «запись идёт» не может продолжаться по определению
  }
}

// ---------------------------------------------------------------------------
// Трей
// ---------------------------------------------------------------------------
function buildTrayMenu(recording = false) {
  const hk = normalizeAccelerator(readSettings().hotkey) || DEFAULT_HOTKEY;
  return Menu.buildFromTemplate([
    { label: 'Открыть 1mesto Flow', click: showDashboard },
    {
      label: recording ? `Остановить диктовку (${hk})` : `Диктовать (${hk})`,
      click: toggleDictation,
    },
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
}

function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray.png');
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath));
  } catch {
    console.error('tray icon failed');
    return;
  }
  tray.setToolTip('1mesto Flow — говори, не печатай');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', showDashboard);
}

/** Перестроить меню трея (хоткей изменился) */
function refreshTray() {
  try {
    if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
  } catch {
    /* не критично */
  }
}

// ---------------------------------------------------------------------------
// Горячая клавиша
// ---------------------------------------------------------------------------
function registerHotkey() {
  globalShortcut.unregisterAll();
  const s = readSettings();
  if (s.hotkeyEnabled === false) return;
  const norm = normalizeAccelerator(s.hotkey) || DEFAULT_HOTKEY;
  const acc = toElectronAccelerator(norm) || 'Alt+Space';
  try {
    const ok = globalShortcut.register(acc, toggleDictation);
    if (!ok) {
      console.error(`Хоткей ${acc} уже занят другой программой`);
      if (dashboard && !dashboard.isDestroyed()) {
        dashboard.webContents.send('flow:hotkey-conflict', acc); // D-05: сообщение в UI
      }
    } else {
      console.log(`Глобальный хоткей: ${acc}`);
    }
    // D-15: отдельная клавиша переключения профиля стиля
    if (s.hotkeyStyle) {
      const accStyle = toElectronAccelerator(normalizeAccelerator(s.hotkeyStyle));
      if (accStyle && globalShortcut.register(accStyle, cycleStyleMode)) {
        console.log(`Хоткей стиля: ${accStyle}`);
      }
    }
  } catch (e) {
    console.error('globalShortcut failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// D-15: циклическое переключение профиля стиля хоткеем
// ---------------------------------------------------------------------------
const STYLE_CYCLE = ['clean', 'email', 'bullets', 'chat', 'code'];
function cycleStyleMode() {
  const cur = readSettings().mode || 'clean';
  const next = STYLE_CYCLE[(STYLE_CYCLE.indexOf(cur) + 1) % STYLE_CYCLE.length];
  writeSettings({ mode: next });
  if (pill && !pill.isDestroyed()) pill.webContents.send('flow:command', 'mode');
  if (dashboard && !dashboard.isDestroyed()) dashboard.webContents.send('flow:mode-changed', next);
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('settings:get', () => readSettings());

ipcMain.handle('settings:save', (_e, patch) => {
  const next = writeSettings(patch || {});
  registerHotkey(); // хоткей мог измениться — перерегистрируем
  refreshTray(); // и обновляем подпись в трее
  return next;
});

ipcMain.on('pill:hide', () => {
  if (pill && !pill.isDestroyed()) pill.hide();
  setRecordingState(false);
});

// B-11: иконка/подсказка трея отражает состояние записи
function setRecordingState(on) {
  try {
    if (!tray || tray.isDestroyed()) return;
    tray.setToolTip(on ? '● 1mesto Flow — идёт запись…' : '1mesto Flow — говори, не печатай');
    tray.setContextMenu(buildTrayMenu(on));
  } catch {
    /* трей может отсутствовать в некоторых DE */
  }
}
ipcMain.on('pill:status', (_e, on) => setRecordingState(!!on));

// AM-03: между подряд идущими репликами вставляем разделяющий пробел
let lastInsert = { at: 0, tail: '' };
ipcMain.handle('pill:insert', async (_e, text) => {
  if (typeof text === 'string' && text.trim()) {
    let toInsert = text;
    const fresh = Date.now() - lastInsert.at < 60000;
    if (fresh && lastInsert.tail && !/\s$/.test(lastInsert.tail) && !/^\s/.test(toInsert)) {
      toInsert = ' ' + toInsert;
    }
    clipboard.writeText(toInsert);
    lastInsert = { at: Date.now(), tail: toInsert };
  }
  return pasteIntoFocusedApp();
});

ipcMain.handle('ai:format', async (_e, payload = {}) => {
  const s = readSettings();
  const { text = '', mode = s.mode, language = s.language } = payload;
  const provider =
    payload.provider && payload.provider !== 'none'
      ? payload.provider
      : s.provider !== 'none'
        ? s.provider
        : null;

  try {
    const timeoutMs = Number(s.aiTimeoutMs) || 25000; // AM-18
    if (provider === 'ollama') {
      const out = await aiFormat(text, mode, language, 'ollama', '', timeoutMs);
      if (out) return { formattedText: out, source: 'ai' };
    } else if (provider) {
      const key = payload.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      if (key) {
        const out = await aiFormat(text, mode, language, provider, key, timeoutMs);
        if (out) return { formattedText: out, source: 'ai' };
      }
    }
  } catch (e) {
    console.error('ai failed:', e.message);
  }

  // локальный умный форматер — всегда (с пользовательским словарём и макросами, H-01)
  const local = formatText(text, {
    mode,
    lang: language === 'en' ? 'en' : 'ru',
    name: payload.name || s.name,
    dict: payload.dict && typeof payload.dict === 'object' ? payload.dict : null,
    macros: payload.macros && typeof payload.macros === 'object' ? payload.macros : null,
    voiceCommands: payload.voiceCommands !== false,
    restoreYo: !!payload.restoreYo,
  });
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

  const args = ['-m', model, '-nt', wavPath];
  if (lang && lang !== 'auto') args.splice(2, 0, '-l', lang); // авто-язык: whisper определит сам
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 300000 }, (err, stdout) => {
      if (err) {
        console.error('whisper failed:', err.message);
        return resolve(null);
      }
      const rawText = String(stdout || '')
        .split('\n')
        .filter((l) => l.trim() && !/^\s*\[|^\s*system_info|whisper_/i.test(l))
        .join(' ')
        .trim();
      const clean = sanitizeTranscript(rawText); // F-22: галлюцинации на тишине срезаем
      resolve(clean.text || null);
    });
  });
}

const GEMINI_AUDIO_LIMIT = 18 * 1024 * 1024; // ~20 МБ лимит REST: больше — просим короче реплику

async function geminiOnce(bytes, lang, model, key) {
  const b64 = Buffer.from(bytes).toString('base64');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  lang === 'auto'
                    ? 'Определи язык аудио самостоятельно и транскрибируй речь дословно. Только текст, без ответов на вопросы из аудио.'
                    : `Транскрибируй речь дословно на ${lang === 'en' ? 'английском' : 'русском'}. Только текст, без ответов на вопросы из аудио.`,
              },
              { inlineData: { mimeType: 'audio/wav', data: b64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 2048 }, // S-12: лимит токенов на реплику
      }),
    }
  );
  return res;
}

async function transcribeGeminiBytes(bytes, lang, attempt = 0) {
  const key = resolveGeminiKey();
  if (!key) return { error: 'no-key' };
  if (bytes.length > GEMINI_AUDIO_LIMIT) {
    return { error: 'запись длиннее ~15 минут — проговори короче или настрой whisper' };
  }
  const model = (process.env.GEMINI_MODEL || 'gemini-flash-latest').split(',')[0].trim();
  let res;
  try {
    res = await geminiOnce(bytes, lang, model, key);
  } catch (e) {
    return { error: `сеть: ${e.message}` };
  }
  // O-08: один повтор при лимите — новые ключи часто упираются в RPM
  if (res.status === 429 && attempt < 1) {
    await new Promise((r) => setTimeout(r, 4000));
    return transcribeGeminiBytes(bytes, lang, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || '';
    if (res.status === 429) return { error: 'лимит Gemini исчерпан (429) — попробуй через минуту' };
    if (res.status === 403 || res.status === 400) return { error: `ключ отклонён (${res.status})` };
    return { error: `Gemini ${res.status}: ${msg.slice(0, 110)}` };
  }
  const out = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join(' ')
    .trim();
  if (!out) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    return { error: reason ? `Gemini: пусто (${reason})` : 'Gemini: пусто' };
  }
  const clean = sanitizeTranscript(stripModelTags(out)); // F-22/F-23 + AM-19
  if (!clean.text) return { error: 'распознаватель вернул мусор — попробуй ещё раз' };
  return { text: clean.text };
}

ipcMain.handle('asr:transcribe', async (_e, bytes, lang = 'ru') => {
  const tmp = path.join(app.getPath('temp'), `flow-${Date.now()}.wav`);
  try {
    let text = null;
    try {
      fs.writeFileSync(tmp, Buffer.from(bytes));
    } catch (e) {
      // O-05: диск заполнен — tmp не критичен, Gemini принимает байты напрямую
      console.error('tmp write failed (disk?):', e.message);
    }
    if (fs.existsSync(tmp)) {
      text = await transcribeWhisper(tmp, lang);
      if (text) return { text, source: 'whisper' };
    }
    const g = await transcribeGeminiBytes(bytes, lang);
    if (g && g.text) return { text: g.text, source: 'gemini' };
    if (g && g.error === 'no-key') {
      return {
        text: '',
        error: 'no-engine',
        hint: 'Добавь ключ Gemini в Настройках → Распознавание — или укажи whisper-cli для офлайна',
      };
    }
    return {
      text: '',
      error: 'no-engine',
      hint: g && g.error ? `Не распознал: ${g.error}` : 'Распознавание недоступно',
    };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* P-10 */
    }
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
  const model =
    s.whisperModel ||
    process.env.WHISPER_MODEL ||
    (fs.existsSync(defaultModelPath()) ? defaultModelPath() : '');
  return {
    platform: process.platform,
    whisperBin: !!bin && fs.existsSync(bin),
    whisperModel: !!model && fs.existsSync(model),
    modelDownloaded: fs.existsSync(defaultModelPath()),
    modelPath: defaultModelPath(),
    geminiKey: !!resolveGeminiKey(s),
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
      const allowed = [
        'media',
        'audioCapture',
        'clipboard-sanitized-write',
        'fullscreen',
        'notifications',
        'clipboard-read',
      ];
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
// backgroundMode: живём в трее; выключен — закрываемся вместе с окном
app.on('window-all-closed', () => {
  if (readSettings().backgroundMode === false) app.quit();
});

// Автозапуск при входе в систему (переключается из Настроек)
ipcMain.handle('app:login-item:get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('app:login-item:set', (_e, v) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!v });
    return app.getLoginItemSettings().openAtLogin;
  } catch (e) {
    console.error('login item failed:', e.message);
    return false;
  }
});
