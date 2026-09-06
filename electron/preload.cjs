// Preload для Electron — безопасный мост (contextIsolation: true).
// ВАЖНО: preload обязан быть CommonJS, поэтому файл .cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowDesktop', {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  insertText: (text) => ipcRenderer.invoke('pill:insert', text),
  aiFormat: (payload) => ipcRenderer.invoke('ai:format', payload),
  hidePill: () => ipcRenderer.send('pill:hide'),
  // B-11: статус записи для трея
  setStatus: (on) => ipcRenderer.send('pill:status', on), // true|false|'processing' (B-11)
  // D-05: конфликт хоткея
  onHotkeyConflict: (cb) => ipcRenderer.on('flow:hotkey-conflict', (_e, acc) => cb(acc)),
  onCommand: (cb) => ipcRenderer.on('flow:command', (_e, cmd) => cb(cmd)),
  // Локальное распознавание: WAV-байты → текст (whisper.cpp / Gemini)
  transcribe: (bytes, lang) => ipcRenderer.invoke('asr:transcribe', bytes, lang),
  downloadModel: () => ipcRenderer.invoke('asr:download-model'),
  downloadBin: () => ipcRenderer.invoke('asr:download-bin'), // 1-клик установка whisper.cpp
  asrCheck: () => ipcRenderer.invoke('asr:check'),
  // Фоновый режим: автозапуск при входе в систему
  getLoginItem: () => ipcRenderer.invoke('app:login-item:get'),
  setLoginItem: (v) => ipcRenderer.invoke('app:login-item:set', v),
});
