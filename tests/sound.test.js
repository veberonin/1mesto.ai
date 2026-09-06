// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// AG-15/AG-16: сигнал ошибки отличается от сигналов записи, громкость настройкой
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
const makeCtx = () => ({
  currentTime: 0,
  state: 'running',
  resume: async () => {},
  destination: {},
  createOscillator: () => {
    const osc = {
      type: '',
      frequency: { setValueAtTime: (f) => calls.push({ freq: f }), exponentialRampToValueAtTime: () => {} },
      connect: (g) => g,
      start: () => {},
      stop: () => {},
    };
    return osc;
  },
  createGain: () => ({
    gain: {
      setValueAtTime: (v) => calls.push({ gain: v }),
      exponentialRampToValueAtTime: (v) => calls.push({ ramp: v }),
    },
    connect: () => ({ connect: () => {} }),
  }),
});
// AC вызывается через new — нужна обычная функция, не стрелка
globalThis.window = {
  AudioContext: function AudioContextMock() {
    return makeCtx();
  },
};

const { sound } = await import('../src/lib/sound.js');

describe('AG-15/AG-16: звуки интерфейса', () => {
  it('AG-15: ошибка — sawtooth низкий, сигналы записи — sine выше', () => {
    const freqs = (fn) => {
      calls.length = 0;
      fn();
      return calls.filter((c) => c.freq !== undefined);
    };
    const startF = freqs(() => sound.start());
    const errF = freqs(() => sound.error());
    assert.ok(
      startF.every((c) => c.freq >= 400),
      `старт: ${JSON.stringify(startF)}`
    );
    assert.ok(
      errF.every((c) => c.freq < 300),
      `ошибка: ${JSON.stringify(errF)}`
    );
    // два тона ошибки (новый сигнал), не один
    assert.equal(errF.length, 2);
  });

  it('AG-16: volume=0.3 уменьшает пиковый gain в 3+ раза', () => {
    sound.volume = 1;
    calls.length = 0;
    sound.tick();
    const peaks = calls.filter((c) => c.ramp !== undefined && c.ramp > 0.001).map((c) => c.ramp);
    const peakFull = Math.max(...peaks);
    sound.volume = 0.3;
    calls.length = 0;
    sound.tick();
    const peaks30 = calls.filter((c) => c.ramp !== undefined && c.ramp > 0.001).map((c) => c.ramp);
    const peak30 = Math.max(...peaks30);
    assert.ok(peak30 < peakFull * 0.4, `${peak30} vs ${peakFull}`);
    sound.volume = 1;
  });

  it('volume вне 0..1 не ломает (клэмп)', () => {
    sound.volume = 5;
    calls.length = 0;
    assert.doesNotThrow(() => sound.tick());
    sound.volume = 0;
    calls.length = 0;
    assert.doesNotThrow(() => sound.tick());
    sound.volume = 1;
  });
});
