// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
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
  onCommand: (cb) => ipcRenderer.on('flow:command', (_e, cmd) => cb(cmd)),
});
