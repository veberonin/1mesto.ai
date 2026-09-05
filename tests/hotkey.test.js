// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHotkey, normalizeAccelerator, isValidAccelerator, toElectronAccelerator,
  hotkeyFromEvent, hotkeyMatches, DEFAULT_HOTKEY,
} from '../src/lib/hotkey.js';

describe('hotkey: parse/normalize', () => {
  it('дефолт — Alt+Space, канонизация регистронезависима', () => {
    assert.equal(DEFAULT_HOTKEY, 'Alt+Space');
    assert.equal(normalizeAccelerator('alt+space'), 'Alt+Space');
    assert.equal(normalizeAccelerator(' ALT + SPACE '), 'Alt+Space');
  });

  it('алиасы модификаторов и кодов', () => {
    assert.equal(normalizeAccelerator('Control+Shift+K'), 'Ctrl+Shift+K');
    assert.equal(normalizeAccelerator('KeyK'), 'K'); // без модификатора
    assert.equal(normalizeAccelerator('Digit5'), '5');
    assert.equal(normalizeAccelerator('CommandOrControl+J'), 'Ctrl+J');
    assert.equal(normalizeAccelerator('Win+X'), 'Meta+X');
    assert.equal(normalizeAccelerator('F5'), 'F5');
  });

  it('мусор → null', () => {
    assert.equal(normalizeAccelerator(''), null);
    assert.equal(normalizeAccelerator(null), null);
    assert.equal(normalizeAccelerator('Alt+'), null);
    assert.equal(normalizeAccelerator('Alt+Ctrl'), null); // нет клавиши
    assert.equal(normalizeAccelerator('Alt+Ctrl+Space+Shift'), null); // клавиша не последняя
    assert.equal(normalizeAccelerator('Alt+Bogus'), null);
    assert.equal(normalizeAccelerator('Ctrl+Alt+Ctrl+K'), null); // дубликат модификатора
  });

  it('валидация: нужен модификатор или F-клавиша', () => {
    assert.ok(isValidAccelerator('Alt+Space'));
    assert.ok(isValidAccelerator('Ctrl+Shift+K'));
    assert.ok(isValidAccelerator('F5'));
    assert.ok(!isValidAccelerator('Space')); // голый Space съест систему
    assert.ok(!isValidAccelerator('K'));
    assert.ok(!isValidAccelerator('Shift+Bogus'));
  });

  it('electron-акселератор: Meta → Super, Ctrl → Control', () => {
    assert.equal(toElectronAccelerator('Alt+Space'), 'Alt+Space');
    assert.equal(toElectronAccelerator('Ctrl+Shift+K'), 'Control+Shift+K');
    assert.equal(toElectronAccelerator('Meta+X'), 'Super+X');
    assert.equal(toElectronAccelerator('ерунда'), null);
  });
});

describe('hotkey: события DOM', () => {
  const ev = (code, mods = {}) => ({
    code,
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta,
  });

  it('hotkeyFromEvent строит каноническую строку', () => {
    assert.equal(hotkeyFromEvent(ev('Space', { alt: true })), 'Alt+Space');
    assert.equal(hotkeyFromEvent(ev('KeyK', { ctrl: true, shift: true })), 'Ctrl+Shift+K');
    assert.equal(hotkeyFromEvent(ev('Comma', { meta: true })), 'Meta+Comma');
    assert.equal(hotkeyFromEvent(ev('F9', { ctrl: true })), 'Ctrl+F9');
    assert.equal(hotkeyFromEvent(ev('ControlLeft', { ctrl: true })), null); // только модификатор
  });

  it('hotkeyMatches: точное соответствие модификаторов', () => {
    assert.ok(hotkeyMatches(ev('Space', { alt: true }), 'Alt+Space'));
    assert.ok(!hotkeyMatches(ev('Space', {}), 'Alt+Space'));
    assert.ok(!hotkeyMatches(ev('Space', { alt: true, ctrl: true }), 'Alt+Space'));
    assert.ok(!hotkeyMatches(ev('Enter', { alt: true }), 'Alt+Space'));
    assert.ok(hotkeyMatches(ev('KeyQ', { ctrl: true, alt: true }), 'Ctrl+Alt+Q'));
  });

  it('match с битым хоткеем — false, не исключение', () => {
    assert.ok(!hotkeyMatches(ev('Space', { alt: true }), 'мусор'));
    assert.ok(!hotkeyMatches(ev('Space', { alt: true }), ''));
  });
});
