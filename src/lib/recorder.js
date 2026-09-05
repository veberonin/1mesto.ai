// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Запись микрофона в WAV 16 кГц моно (C-10/C-11) — для локального распознавания.
 * Работает в браузере и в Electron. encodeWav — чистая функция, покрыта тестами.
 */

/** Float32 [-1..1] → WAV (PCM16) байты. Чистая функция. */
export function encodeWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // моно
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byteRate
  view.setUint16(32, 2, true); // blockAlign
  view.setUint16(34, 16, true); // bits
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** Простая передискретизация усреднением (48к → 16к = фактор 3) */
export function resample(f32, from, to) {
  if (from === to) return f32;
  const factor = from / to;
  const outLen = Math.floor(f32.length / factor);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * factor);
    const end = Math.min(f32.length, Math.floor((i + 1) * factor));
    let sum = 0;
    for (let j = start; j < end; j++) sum += f32[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

const MAX_SECONDS = 900; // C-15: до 15 минут одной реплики

export class WavCapture {
  constructor() {
    this.chunks = [];
    this.total = 0;
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.source = null;
  }

  async start(onLevel) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    const rate = this.ctx.sampleRate;

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      // уровень для волны
      if (onLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        onLevel(Math.min(1, Math.sqrt(sum / input.length) * 3.2));
      }
      if (this.total < MAX_SECONDS * rate) {
        const down = resample(input, rate, 16000);
        this.chunks.push(down);
        this.total += down.length;
      }
    };
    this.source.connect(this.node);
    this.node.connect(this.ctx.destination); // ScriptProcessor требует вывода
  }

  /** Останавливает и возвращает WAV-байты (Uint8Array, 16 кГц моно) */
  stop() {
    try {
      if (this.node) this.node.disconnect();
      if (this.source) this.source.disconnect();
      if (this.ctx) this.ctx.close().catch(() => {});
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    const all = new Float32Array(this.total);
    let off = 0;
    for (const c of this.chunks) {
      all.set(c, off);
      off += c.length;
    }
    this.chunks = [];
    this.total = 0;
    return encodeWav(all, 16000);
  }
}
