// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, resample } from '../src/lib/recorder.js';

const asBuf = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);

describe('recorder: encodeWav', () => {
  it('генерирует корректный WAV-заголовок (44 байта) и PCM16 mono', () => {
    const pcm = new Float32Array(1600); // 0.1 s @16k
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i / 10) * 0.5;
    const wav = asBuf(encodeWav(pcm, 16000));
    assert.equal(wav.length, 44 + 1600 * 2);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav[20], 1); // PCM
    assert.equal(wav[22], 1); // mono
    assert.equal(wav.readUInt32LE(24), 16000); // sampleRate
    assert.equal(wav.readUInt32LE(28), 32000); // byteRate
    assert.equal(wav.readUInt16LE(34), 16); // bitsPerSample
    assert.equal(wav.readUInt32LE(40), 3200); // data size
  });

  it('клампит сэмплы в [-1, 1] и кодирует амплитуду', () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 2, -2]);
    const wav = asBuf(encodeWav(pcm, 16000));
    assert.equal(wav.readInt16LE(44 + 0 * 2), 0);
    assert.equal(wav.readInt16LE(44 + 1 * 2), Math.trunc(0.5 * 0x7fff));
    assert.equal(wav.readInt16LE(44 + 2 * 2), Math.trunc(-0.5 * 0x8000));
    assert.equal(wav.readInt16LE(44 + 3 * 2), 32767);
    assert.equal(wav.readInt16LE(44 + 4 * 2), -32768);
  });

  it('пустой буфер → валидный WAV без данных', () => {
    const wav = asBuf(encodeWav(new Float32Array(0), 16000));
    assert.equal(wav.length, 44);
    assert.equal(wav.readUInt32LE(40), 0);
  });
});

describe('recorder: resampleTo16k', () => {
  it('понижает частоту с сохранением длительности и энергии', () => {
    const sec = 2;
    const src = new Float32Array(48000 * sec).fill(0.25);
    const out = resample(src, 48000, 16000);
    assert.equal(out.length, 16000 * sec);
    const avg = out.reduce((a, b) => a + b, 0) / out.length;
    assert.ok(avg > 0.2 && avg < 0.3, `avg=${avg}`);
  });

  it('апсемплинг 8k→16k удваивает длину', () => {
    const out = resample(new Float32Array(8000), 8000, 16000);
    assert.equal(out.length, 16000);
  });

  it('16k проходит без изменений (тот же буфер)', () => {
    const src = new Float32Array(1600).fill(0.5);
    assert.equal(resample(src, 16000, 16000), src);
  });
});
