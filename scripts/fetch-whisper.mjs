// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Скачивает официальный прекомпилированный whisper.cpp + модель ggml-base-q5_1
 * в extra/whisper/ — чтобы установщик содержал распознаватель ИЗ КОРОБКИ
 * («фулл локально»): без сети после установки и без кнопок скачивания.
 * Запускается в release.yml ПЕРЕД electron-builder на каждом раннере.
 * SHA-256 pinned: те же ассеты, что и у кнопки «whisper в 1 клик» (A-08/A-09).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TAG = process.env.WHISPER_BIN_TAG || 'b4938';
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin';
const MODEL_SHA = '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898';
// «Главное чтобы всё работало»: small-q5_1 заметно точнее по-русски (~181 МБ),
// конкуренты шипят 500 МБ–1.5 ГБ — место не экономим, качество приоритетно
const MODEL_SMALL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin';
const MODEL_SMALL_SHA = 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb';

const BINS = {
  win32: {
    url: `https://github.com/ggml-org/whisper.cpp/releases/download/${TAG}/whisper-blas-bin-x64.zip`,
    sha256: '78568aa80b361382cb303438a7be3b05669651f2ca8258910394679e049d26ea',
    inner: 'Release',
  },
  linux: {
    url: `https://github.com/ggml-org/whisper.cpp/releases/download/${TAG}/whisper-bin-ubuntu-x64.tar.gz`,
    sha256: 'f4cfc1f969a13805908fb72043ce7cc896eb42e0b8afbe841dc8e7298923b061',
  },
};

const out = path.join(process.cwd(), 'extra', 'whisper');
fs.mkdirSync(out, { recursive: true });
const sha = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// 1) Модели — на всех платформах (whisper на mac ставится через brew, модели наши)
async function grabModel(dst, url, sha256, label) {
  if (fs.existsSync(dst) && sha(dst) === sha256) {
    console.log(`${label} уже в extra/whisper ✓`);
    return;
  }
  console.log(`качаю ${label}…`);
  execFileSync('curl', ['-fL', '--retry', '3', '-o', dst, url], { stdio: 'inherit' });
  if (sha(dst) !== sha256) throw new Error(`SHA-256 ${label} не сошёлся`);
  console.log(`${label} ✓`);
}
await grabModel(path.join(out, 'ggml-base-q5_1.bin'), MODEL_URL, MODEL_SHA, 'базовая модель');
await grabModel(
  path.join(out, 'ggml-small-q5_1.bin'),
  MODEL_SMALL_URL,
  MODEL_SMALL_SHA,
  'модель small (точнее)'
);

// 2) Бинарь — где есть официальные прекомпилы (win/linux)
const meta = BINS[process.platform];
if (!meta) {
  console.log(
    `для ${process.platform} прекомпилов нет (mac: brew install whisper-cpp) — бандлю только модель`
  );
  process.exit(0);
}
const archive = path.join(out, path.basename(meta.url));
if (!fs.existsSync(archive) || sha(archive) !== meta.sha256) {
  console.log('качаю whisper.cpp…');
  execFileSync('curl', ['-fL', '--retry', '3', '-o', archive, meta.url], { stdio: 'inherit' });
  if (sha(archive) !== meta.sha256) throw new Error('SHA-256 бинаря не сошёлся');
}
if (process.platform === 'win32') {
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${archive}' -DestinationPath '${out}'`],
    {
      stdio: 'inherit',
    }
  );
  // App-local VC++ runtime: без VC++ Redistributable загрузчик Windows молча убивает
  // main.exe (пустой stderr, «Command failed»). Microsoft официально поддерживает
  // развёртывание этих DLL рядом с exe — берём их из System32 раннера (там стоит VS).
  const sys32 = path.join(process.env.WINDIR || 'C:\\Windows', 'System32');
  const rel = path.join(out, 'Release');
  for (const dll of ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll', 'vcomp140.dll']) {
    const src = path.join(sys32, dll);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(rel, dll));
      console.log('VC runtime в комплекте:', dll);
    } else {
      console.warn(`! ${dll} не найден в System32 — на целевой машине нужен VC++ Redistributable`);
    }
  }
} else {
  execFileSync('tar', ['-xzf', archive, '-C', out], { stdio: 'inherit' });
}
fs.rmSync(archive, { force: true });
console.log('whisper.cpp ✓ в extra/whisper:', fs.readdirSync(out).join(', '));
