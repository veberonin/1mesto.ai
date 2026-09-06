// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Мост между браузерным кодом и Electron (preload.cjs прокидывает window.flowDesktop).
 * На сайте все методы — безопасные no-op фолбэки (веб-режим без Electron-моста).
 */

const noop = async () => null;

export const isDesktop = () => typeof window !== 'undefined' && !!window.flowDesktop;

export const desktopAPI =
  typeof window !== 'undefined' && window.flowDesktop
    ? window.flowDesktop
    : {
        platform: 'web',
        getSettings: noop,
        saveSettings: noop,
        insertText: noop,
        pasteTest: async () => [],
        aiFormat: noop,
        hidePill: noop,
        onCommand: noop,
        transcribe: noop,
        downloadModel: noop,
        downloadBin: noop,
        asrCheck: noop,
        getLoginItem: async () => false,
        setLoginItem: async () => false,
        setStatus: async () => {},
        onHotkeyConflict: () => {},
      };
