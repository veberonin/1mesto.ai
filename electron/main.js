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
  autostart: false, // B-10: автозапуск при входе в систему (настройка)
  vadThreshold: 0.01, // E-04: порог VAD (амплитуда 0..1)
  triggerMode: 'toggle', // AM-01: toggle | hold
  insertDelayMs: 0, // AM-20: пауза перед вставкой (мс, 0..2000)
  asrProvider: 'auto', // P-08: auto (Web Speech+резервы) | whisper (только офлайн) | gemini
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
// A-08/V-04: прекомпилированный whisper.cpp с официальных релизов,
// SHA-256 зафиксированы (digest из GitHub API релиза b4938). WHISPER_BIN_TAG — оверрайд.
const WHISPER_BIN_TAG = process.env.WHISPER_BIN_TAG || 'b4938';
const WHISPER_BINS = {
  win32: {
    asset: `whisper-blas-bin-x64.zip`,
    url: `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_BIN_TAG}/whisper-blas-bin-x64.zip`,
    sha256: '78568aa80b361382cb303438a7be3b05669651f2ca8258910394679e049d26ea',
    inner: 'Release/main.exe',
  },
  linux: {
    asset: `whisper-bin-ubuntu-x64.tar.gz`,
    url: `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_BIN_TAG}/whisper-bin-ubuntu-x64.tar.gz`,
    sha256: 'f4cfc1f969a13805908fb72043ce7cc896eb42e0b8afbe841dc8e7298923b061',
    inner: 'whisper-bin-ubuntu-x64/whisper-cli',
  },
};

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
  if (
    next.hotkey &&
    next.hotkeyStyle &&
    normalizeAccelerator(next.hotkey) === normalizeAccelerator(next.hotkeyStyle)
  ) {
    console.warn(`[settings] hotkeyStyle совпадает с главным хоткеем — вернул ${DEFAULTS.hotkeyStyle}`);
    next.hotkeyStyle = DEFAULTS.hotkeyStyle;
  }
  if (next.language !== undefined && !['ru', 'en', 'auto'].includes(next.language)) {
    next.language = 'ru';
  }
  if (next.insertDelayMs !== undefined) {
    const n = Number(next.insertDelayMs);
    if (!Number.isFinite(n) || n < 0 || n > 2000) {
      console.warn(`[settings] insertDelayMs ${next.insertDelayMs} вне 0..2000 — вернул 0`);
      next.insertDelayMs = 0;
    }
  }
  if (
    next.asrProvider !== undefined &&
    !['auto', 'webspeech', 'whisper', 'gemini'].includes(next.asrProvider)
  ) {
    console.warn(`[settings] asrProvider «${next.asrProvider}» — вернул auto`);
    next.asrProvider = 'auto';
  }
  if (next.triggerMode !== undefined && !['toggle', 'hold'].includes(next.triggerMode)) {
    console.warn(`[settings] triggerMode «${next.triggerMode}» — вернул toggle`);
    next.triggerMode = DEFAULTS.triggerMode;
  }
  if (next.vadThreshold !== undefined) {
    const n = Number(next.vadThreshold);
    if (!Number.isFinite(n) || n < 0.0005 || n > 0.5) {
      console.warn(
        `[settings] vadThreshold ${next.vadThreshold} вне 0.0005..0.5 — вернул ${DEFAULTS.vadThreshold}`
      );
      next.vadThreshold = DEFAULTS.vadThreshold;
    }
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
    // ФОКУС НЕ КРАДЁМ: если пилюля заберёт клавиатурный фокус, Ctrl+V уйдёт в
    // пилюлю вместо приложения юзера — «текст не вставляется». Клики работают.
    focusable: false,
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
  pill.showInactive(); // без фокуса: диктуем в то приложение, где стоял курсор
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
      if (accStyle && accStyle !== acc) {
        if (globalShortcut.register(accStyle, cycleStyleMode)) {
          console.log(`Хоткей стиля: ${accStyle}`);
        } else {
          console.error(`Хоткей стиля ${accStyle} занят другой программой`);
          if (dashboard && !dashboard.isDestroyed()) {
            dashboard.webContents.send('flow:hotkey-conflict', accStyle); // D-05
          }
        }
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
  try {
    app.setLoginItemSettings({ openAtLogin: next.autostart === true }); // B-10
  } catch {}
  return next;
});

ipcMain.on('pill:hide', () => {
  if (pill && !pill.isDestroyed()) pill.hide();
  setRecordingState(false);
});

// B-11: иконка/подсказка трея отражает состояние записи
// B-11: иконка трея показывает состояние — 'idle' | 'recording' | 'processing'
// (без мигания: меняем только tooltip и меню, картинку не дёргаем — AM-11)
function setTrayState(state) {
  try {
    if (!tray || tray.isDestroyed()) return;
    const labels = {
      idle: '1mesto Flow — говори, не печатай',
      recording: '● 1mesto Flow — идёт запись…',
      processing: '⟳ 1mesto Flow — полировка текста…',
    };
    tray.setToolTip(labels[state] || labels.idle);
    tray.setContextMenu(buildTrayMenu(state === 'recording'));
  } catch {
    /* трей может отсутствовать в некоторых DE */
  }
}
function setRecordingState(on) {
  setTrayState(on ? 'recording' : 'idle');
}
ipcMain.on('pill:status', (_e, on) => {
  // B-11: три состояния трея — запись / полировка / готов
  if (on === 'processing') setTrayState('processing');
  else if (on) setTrayState('recording');
  else setTrayState('idle');
});

// AM-03: между подряд идущими репликами вставляем разделяющий пробел
let lastInsert = { at: 0, tail: '' };
// L-01/AM-06: буфер пользователя сохраняется и восстанавливается после вставки.
// Восстановление — с задержкой (целевое приложение должно принять Ctrl+V первым,
// иначе вставится восстановленный старый текст), при неудаче вставки наш текст
// остаётся в буфере (O-15: ошибка вставки → текст доступен для ручной вставки).
let clipboardBackup = { text: null, at: 0 };
let clipboardRestoreTimer = null;
ipcMain.handle('pill:insert', async (_e, text) => {
  if (typeof text === 'string' && text.trim()) {
    let toInsert = text;
    const fresh = Date.now() - lastInsert.at < 60000;
    if (fresh && lastInsert.tail && !/\s$/.test(lastInsert.tail) && !/^\s/.test(toInsert)) {
      toInsert = ' ' + toInsert;
    }
    // L-01: запоминаем прежний буфер один раз (не затирая бэкап бэкапом при серии реплик)
    try {
      const cur = clipboard.readText();
      if (!clipboardBackup.text || Date.now() - clipboardBackup.at > 5000) {
        clipboardBackup = { text: cur, at: Date.now() };
      }
    } catch {
      /* буфер недоступен — вставляем без бэкапа */
    }
    clipboard.writeText(toInsert);
    lastInsert = { at: Date.now(), tail: toInsert };
  }
  // AM-20: настраиваемая пауза перед вставкой (медленным приложениям нужно время сфокусироваться)
  // Пилюля обязана быть скрыта ДО Ctrl+V: иначе вставка уйдёт в неё, а не в приложение юзера
  try {
    if (pill && !pill.isDestroyed() && pill.isVisible()) {
      pill.hide();
      await new Promise((r) => setTimeout(r, 180)); // Windows: фокус возвращается предыдущему окну
    }
  } catch {}
  const delay = Number(readSettings().insertDelayMs) || 0;
  if (delay > 0) await new Promise((r) => setTimeout(r, Math.min(delay, 2000)));
  const result = await pasteIntoFocusedApp();
  // AM-06: без гонки — восстанавливаем буфер только после успешной вставки
  // и только если целевое приложение успело забрать наш текст (задержка > обработки Ctrl+V)
  const pasteOk = result && result.method === 'paste' && !result.error;
  if (pasteOk && clipboardBackup.text !== null) {
    if (clipboardRestoreTimer) clearTimeout(clipboardRestoreTimer);
    clipboardRestoreTimer = setTimeout(() => {
      try {
        clipboard.writeText(clipboardBackup.text);
      } catch {
        /* не смогли восстановить — в буфере остаётся реплика, не страшно */
      }
      clipboardBackup = { text: null, at: 0 };
    }, 600);
  }
  return result;
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
// Предустановленный whisper (extraResources, «фулл-офлайн из коробки»):
// установщик уже содержит бинарь и модель — настройки юзера не обязательны
function bundledBin() {
  if (process.platform === 'win32')
    return path.join(process.resourcesPath || '', 'whisper', 'Release', 'main.exe');
  if (process.platform === 'linux')
    return path.join(process.resourcesPath || '', 'whisper', 'whisper-bin-ubuntu-x64', 'whisper-cli');
  return '';
}
function bundledModel() {
  return path.join(process.resourcesPath || '', 'whisper', 'ggml-base-q5_1.bin');
}

async function transcribeWhisper(wavPath, lang) {
  const s = readSettings();
  const bin = s.whisperBin || process.env.WHISPER_BIN || (fs.existsSync(bundledBin()) ? bundledBin() : '');
  let model = s.whisperModel || process.env.WHISPER_MODEL || '';
  if (!model && fs.existsSync(defaultModelPath())) model = defaultModelPath();
  if (!model && fs.existsSync(bundledModel())) model = bundledModel();
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

const ASR_MODELS = (process.env.GEMINI_MODEL || 'gemini-flash-latest,gemini-3.6-flash,gemini-3.7-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/**
 * Распознавание с фолбэк-цепочкой моделей: у облачных моделей квоты заканчиваются
 * по одной (429) и модели отзываются (404) — пробуем следующую в списке, чтобы
 * диктовка не падала, пока жива хоть одна модель (надёжность > одного провайдера).
 */
async function transcribeGeminiBytes(bytes, lang, attempt = 0, mi = 0) {
  const key = resolveGeminiKey();
  if (!key) return { error: 'no-key' };
  if (bytes.length > GEMINI_AUDIO_LIMIT) {
    return { error: 'запись длиннее ~15 минут — проговори короче или настрой whisper' };
  }
  const model = ASR_MODELS[Math.min(mi, ASR_MODELS.length - 1)];
  let res;
  try {
    res = await geminiOnce(bytes, lang, model, key);
  } catch (e) {
    return { error: `сеть: ${e.message}` };
  }
  // O-08: один повтор при лимите — новые ключи часто упираются в RPM
  if (res.status === 429 && attempt < 1) {
    await new Promise((r) => setTimeout(r, 4000));
    return transcribeGeminiBytes(bytes, lang, attempt + 1, mi);
  }
  // 429 после повтора / 404 (модель отозвана) → следующая модель списка: у неё своя квота
  const data0 = res.status === 429 || res.status === 404 ? await res.json().catch(() => ({})) : null;
  const msg0 = data0?.error?.message || '';
  const modelDead = res.status === 404 || (res.status === 429 && /quota.*model|model.*quota/i.test(msg0));
  if ((res.status === 429 || modelDead) && mi + 1 < ASR_MODELS.length) {
    console.warn(`[asr] модель ${model} недоступна (${res.status}) — фолбэк на ${ASR_MODELS[mi + 1]}`);
    return transcribeGeminiBytes(bytes, lang, 0, mi + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || '';
    if (res.status === 429) {
      return {
        error:
          ASR_MODELS.length > 1
            ? 'лимит всех моделей Gemini исчерпан (429) — через минуту восстановится или настрой whisper'
            : 'лимит Gemini исчерпан (429) — попробуй через минуту',
      };
    }
    if (res.status === 403 || res.status === 400) return { error: `ключ отклонён (${res.status})` };
    if (res.status >= 500) {
      return {
        error:
          'модели Gemini перегружены (503) — облачный резерв временно занят; включи whisper в настройках для полного офлайна',
      };
    }
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
        hint: 'Распознаватель не настроен: Настройки → «Установить whisper в 1 клик» — или вставь ключ Gemini',
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

// Скачивание с ретраями: домашний интернет рвёт соединение — 2 повторы спасают
async function fetchAsset(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status >= 500 && i < tries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`GitHub ${res.status} — попробуй позже или скачай вручную по ссылке`);
    } catch (e) {
      if (/^GitHub \d/.test(e.message)) throw e; // 4xx/5xx — не сетевой сбой, ретрай бессмыслен
      if (i < tries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(
        'сеть недоступна — проверь интернет/VPN и нажми ещё раз (или скачай вручную по ссылке)'
      );
    }
  }
}

ipcMain.handle('asr:download-bin', async () => {
  // «Вставка из коробки как у лучшего конкурента, но легально»: официальный
  // прекомпилированный whisper.cpp в 1 клик — без сборки и ручных путей.
  const meta = WHISPER_BINS[process.platform];
  if (!meta) {
    return {
      ok: false,
      reason: 'Автоскачивание для этой ОС не настроено — на macOS: brew install whisper-cpp и укажи путь',
    };
  }
  const binDir = path.join(app.getPath('userData'), 'bin', 'whisper');
  fs.mkdirSync(binDir, { recursive: true });
  // Уже установлен? Не ходим в сеть вовсе (повторное нажатие кнопки — не ошибка)
  const fallbackPath = path.join(binDir, process.platform === 'win32' ? 'main.exe' : 'whisper-cli');
  const innerPath = path.join(binDir, meta.inner);
  const present = fs.existsSync(innerPath) ? innerPath : fs.existsSync(fallbackPath) ? fallbackPath : '';
  if (present) {
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(present, 0o755);
      } catch {}
    }
    if (readSettings().whisperBin !== present) writeSettings({ whisperBin: present });
    return { ok: true, existing: true, path: present };
  }
  const archive = path.join(binDir, meta.asset);
  const res = await fetchAsset(meta.url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(archive, buf);
  const hash = await sha256File(archive);
  if (hash !== meta.sha256) {
    fs.unlinkSync(archive);
    throw new Error(`SHA-256 не сошёлся: ${hash.slice(0, 16)}…`);
  }
  // распаковка: Windows — PowerShell Expand-Archive, unix — tar
  if (process.platform === 'win32') {
    await new Promise((resolve, reject) => {
      execFile(
        'powershell',
        ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${archive}' -DestinationPath '${binDir}'`],
        { timeout: 120000 },
        (e) => (e ? reject(e) : resolve())
      );
    });
  } else {
    await new Promise((resolve, reject) => {
      execFile('tar', ['-xzf', archive, '-C', binDir], { timeout: 120000 }, (e) =>
        e ? reject(e) : resolve()
      );
    });
  }
  let binPath = path.join(binDir, meta.inner);
  if (!fs.existsSync(binPath)) {
    const fallback = path.join(binDir, process.platform === 'win32' ? 'main.exe' : 'whisper-cli');
    if (fs.existsSync(fallback)) binPath = fallback;
    else throw new Error('бинарник не найден внутри архива');
  }
  if (process.platform !== 'win32') fs.chmodSync(binPath, 0o755);
  writeSettings({ whisperBin: binPath });
  try {
    fs.unlinkSync(archive);
  } catch {}
  return { ok: true, path: binPath, sha256: hash };
});

ipcMain.handle('asr:check', async () => {
  const s = readSettings();
  const bin = s.whisperBin || process.env.WHISPER_BIN || (fs.existsSync(bundledBin()) ? bundledBin() : '');
  const model =
    s.whisperModel ||
    process.env.WHISPER_MODEL ||
    (fs.existsSync(defaultModelPath()) ? defaultModelPath() : '') ||
    (fs.existsSync(bundledModel()) ? bundledModel() : '');
  return {
    platform: process.platform,
    whisperBin: !!bin && fs.existsSync(bin),
    whisperModel: !!model && fs.existsSync(model),
    bundled: !!process.resourcesPath && fs.existsSync(bundledModel()) && fs.existsSync(bundledBin()),
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
  // O-14: вторая копия завершается с понятным сообщением (stderr + лог)
  const msg = '1mesto Flow уже запущен — активирую существующее окно и завершаю эту копию.';
  console.error(msg);
  process.stderr.write(`${msg}
`);
  try {
    const logPath = path.join(app.getPath('userData'), 'flow.log');
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} second-instance: ${msg}
`
    );
  } catch {}
  app.quit();
} else {
  app.on('second-instance', showDashboard);

  app.whenReady().then(() => {
    // B-10: автозапуск включается настройкой из settings.json
    try {
      app.setLoginItemSettings({ openAtLogin: readSettings().autostart === true });
    } catch (e) {
      console.error('login item failed:', e.message);
    }
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
