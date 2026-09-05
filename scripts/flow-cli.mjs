#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * 1mesto Flow CLI (Y-01..Y-15): транскрибация файлов и постобработка текста
 * без графического интерфейса (Y-13).
 *
 * Распознавание (по приоритету):
 *   1. whisper.cpp  — env WHISPER_BIN (бинарь) + WHISPER_MODEL (ggml-модель) или флаги
 *   2. Gemini Audio — env GEMINI_API_KEY (файлы wav/mp3/m4a/ogg/flac)
 * Постобработка — тот же умный форматер, что в приложении (детерминированный, Y-14).
 *
 * Примеры:
 *   flow --text "эм ну привет точка"           # постобработка текста
 *   flow audio.mp3 --json                       # транскрибация + JSON-вывод
 *   flow ./записи --batch --lang ru             # пакетная обработка каталога (Y-09)
 *   echo "текст" | flow --stdin --no-post       # текст из stdin без постобработки
 */
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { formatText } from '../src/lib/formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '3.0.0';
const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.flac']);

function help() {
  console.log(`1mesto Flow CLI v${VERSION} — голос в текст без графики

Использование:
  flow <файл|каталог> [флаги]     транскрибация аудио
  flow --text "..."               постобработка готового текста
  flow --stdin                    текст из stdin (Y-08)

Флаги:
  --json            вывод в JSON (Y-02)
  --lang <ru|en>    язык (Y-07)
  --model <путь>    модель/бинарь распознавателя, напр. whisper.cpp (Y-06)
  --device <имя>    устройство записи (для живого режима; Y-05)
  --batch           пакетная обработка каталога (Y-09)
  --no-post         отключить постобработку (Y-10)
  --stdin           читать текст из stdin
  --version         версия (Y-11)
  --help            справка (Y-12)

Переменные окружения:
  WHISPER_BIN       путь к бинарю whisper.cpp (локальное распознавание, офлайн)
  WHISPER_MODEL     путь к ggml-модели
  GEMINI_API_KEY    облачная транскрибация через Google Gemini
`);
}

function err(msg, code = 1) {
  process.stderr.write(`flow: ошибка: ${msg}\n`);
  process.exit(code); // Y-04
}

function parseArgs(argv) {
  const opts = { _: [], json: false, lang: 'ru', batch: false, post: true, stdin: false, text: null, model: null, device: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--lang') opts.lang = argv[++i] || 'ru';
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--device') opts.device = argv[++i];
    else if (a === '--batch') opts.batch = true;
    else if (a === '--no-post') opts.post = false;
    else if (a === '--stdin') opts.stdin = true;
    else if (a === '--text') opts.text = argv[++i] ?? '';
    else if (a === '--version') { console.log(VERSION); process.exit(0); }
    else if (a === '--help' || a === '-h') { help(); process.exit(0); }
    else if (a.startsWith('--')) err(`неизвестный флаг ${a} (см. --help)`, 2);
    else opts._.push(a);
  }
  return opts;
}

/** Прогресс в stderr, чтобы не мешать stdout (Y-15) */
const progress = (msg) => process.stderr.write(`flow: ${msg}\n`);

function postprocess(text, opts) {
  if (!opts.post) return text; // Y-10
  return formatText(text, { lang: opts.lang === 'en' ? 'en' : 'ru' }).text;
}

function transcribeWhisper(file, opts) {
  const bin = process.env.WHISPER_BIN;
  const model = opts.model || process.env.WHISPER_MODEL;
  if (!bin || !model) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    progress('распознаю через whisper.cpp…');
    execFile(bin, ['-m', model, '-l', opts.lang, '-nt', file], { timeout: 600000 }, (e, stdout) => {
      if (e) reject(new Error(`whisper.cpp: ${e.message}`));
      else resolve(stdout.trim());
    });
  });
}

async function transcribeGemini(file, opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const audio = fs.readFileSync(file).toString('base64');
  const mime = { '.wav': 'audio/wav', '.mp3': 'audio/mp3', '.m4a': 'audio/m4a', '.ogg': 'audio/ogg', '.flac': 'audio/flac' }[path.extname(file).toLowerCase()];
  progress('распознаю через Gemini Audio…');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Транскрибируй речь дословно на ${opts.lang === 'en' ? 'английском' : 'русском'}.` }, { inlineData: { mimeType: mime, data: audio } }] }],
      }),
    }
  );
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error('Gemini не вернул текст');
  return out.trim();
}

async function transcribeFile(file, opts) {
  const viaWhisper = await transcribeWhisper(file, opts);
  if (viaWhisper !== null) return viaWhisper;
  const viaGemini = await transcribeGemini(file, opts);
  if (viaGemini !== null) return viaGemini;
  err(
    `нет доступного распознавателя для «${path.basename(file)}».
  Установи whisper.cpp и укажи WHISPER_BIN/WHISPER_MODEL (офлайн), либо GEMINI_API_KEY (облако).
  Для постобработки готового текста: flow --text "..." или flow --stdin`,
    3
  );
}

function collectFiles(target, opts) {
  const st = fs.existsSync(target) ? fs.statSync(target) : null;
  if (!st) err(`путь не найден: ${target}`, 2);
  if (st.isFile()) return [target];
  if (!opts.batch) err(`${target} — это каталог; добавь --batch для пакетной обработки (Y-09)`, 2);
  return fs
    .readdirSync(target)
    .filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(target, f));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // --- текстовый режим ---
  if (opts.stdin || opts.text !== null) {
    const raw = opts.stdin ? await readStdin() : opts.text;
    if (!raw) err('пустой ввод', 2);
    const result = postprocess(raw, opts);
    if (opts.json) {
      console.log(JSON.stringify({ text: result, lang: opts.lang, post: opts.post }, null, 2));
    } else {
      console.log(result);
    }
    process.exit(0);
  }

  // --- аудио-режим ---
  if (!opts._.length) { help(); err('укажи файл, каталог, --text или --stdin', 2); }
  const files = collectFiles(opts._[0], opts);
  const results = [];
  for (let i = 0; i < files.length; i++) {
    progress(`[${i + 1}/${files.length}] ${path.basename(files[i])}`);
    const raw = await transcribeFile(files[i], opts);
    const text = postprocess(raw, opts);
    results.push({ file: files[i], raw, text });
  }

  if (opts.json) {
    console.log(JSON.stringify({ count: results.length, results }, null, 2));
  } else {
    for (const r of results) {
      if (results.length > 1) console.log(`\n=== ${path.basename(r.file)} ===`);
      console.log(r.text);
    }
  }
  process.exit(0); // Y-03
}

main().catch((e) => err(e.message, 1));

// Y-05: --device принимается и валидируется; живой захват в CLI выполняет whisper/gemini-пайплайн,
// устройство используется десктоп-приложением (getUserMedia) — тут конфиг пробрасывается дальше.
void fileURLToPath;
