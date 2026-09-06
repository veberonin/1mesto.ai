// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(process.cwd(), 'src');
const read = (p) => readFileSync(join(srcRoot, p), 'utf8');

describe('redesign: светлая система как в оригинале', () => {
  it('tailwind.config.js: палитра paper/ink/accent задана', () => {
    const cfg = readFileSync(join(process.cwd(), 'tailwind.config.js'), 'utf8');
    assert.match(cfg, /#F5F2EB/); // paper
    assert.match(cfg, /#DD5B0A/); // accent
    assert.match(cfg, /ink/);
  });

  it('в App/Dictation/Sidebar/Pill не осталось тёмно-градиентных классов', () => {
    for (const f of [
      'App.jsx',
      'components/DictationTab.jsx',
      'components/Sidebar.jsx',
      'components/DictationPill.jsx',
    ]) {
      const s = read(f);
      assert.doesNotMatch(s, /from-brand-(orange|flame|violet|rose)/, `${f}: градиентный бренд-класс`);
      assert.doesNotMatch(s, /bg-slate-9|bg-\[#0/, `${f}: тёмный фон`);
    }
  });

  it('пилюля — чёрная с белыми барами (как в оригинале)', () => {
    const pill = read('components/DictationPill.jsx');
    assert.match(pill, /ink-950/);
    assert.match(pill, /bg-white/);
    assert.doesNotMatch(pill, /from-brand-/);
  });

  it('приветствие с оранжевыми кейкапами — есть', () => {
    const d = read('components/DictationTab.jsx');
    assert.match(d, /Keycaps/);
    assert.match(d, /вернись в поток/);
  });

  it('лента «Сегодня» и правый рельс подключены', () => {
    const d = read('components/DictationTab.jsx');
    assert.match(d, /TodayList/);
    assert.match(d, /StatRail/);
  });

  it('recorder: WavCapture доступен для десктоп-фолбэка', () => {
    const rec = read('lib/recorder.js');
    assert.match(rec, /class WavCapture/);
    assert.match(rec, /export/);
  });

  it('App: WAV-фолбэк и дедуп тостов на месте', () => {
    const app = read('App.jsx');
    assert.match(app, /WavCapture/);
    assert.match(app, /desktopAPI\.transcribe/);
    assert.match(app, /lastToastRef/);
  });

  it('Settings: секция «Распознавание» с кнопкой скачать модель', () => {
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /AsrCard/);
    assert.match(st, /downloadModel/);
    assert.match(st, /whisperBin/);
  });

  it('Sidebar: 4 вкладки + карточка скачивания', () => {
    const sb = read('components/Sidebar.jsx');
    for (const word of ['Диктовка', 'История', 'Настройки', 'О проекте', 'Скачать']) {
      assert.match(sb, new RegExp(word));
    }
  });

  it('демо-режимы полностью выпилены из UI', () => {
    for (const f of ['App.jsx', 'components/DictationTab.jsx']) {
      const s = read(f);
      assert.doesNotMatch(s, /[Дд]емо|runDemo|onDemo|DEMO_SAMPLES/, `${f}: остались следы демо`);
    }
  });

  it('пилюля десктопа: WAV-фолбэк и режим ?pill=1', () => {
    const pill = read('components/PillWindow.jsx');
    assert.match(pill, /WavCapture/);
    assert.match(pill, /desktopAPI\.transcribe/);
    assert.match(pill, /transcriptRef/);
    const main = read('main.jsx');
    assert.match(main, /PillWindow/); // режим ?pill=1 разруливает main.jsx
  });

  it('ErrorBoundary оборачивает приложение (нет «пустых тёмных окон»)', () => {
    const main = read('main.jsx');
    assert.match(main, /ErrorBoundary/);
    assert.match(main, /pillMode \? <PillWindow \/> : <App \/>/);
  });

  it('окно дашборда светлое (backgroundColor paper)', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /backgroundColor: '#F5F2EB'/);
    assert.match(mj, /dictText/); // настройки словаря в DEFAULTS
  });

  it('словарь/макросы доходят до форматтера (App + сервер + пилюля)', () => {
    assert.match(read('App.jsx'), /parsePairsText/);
    assert.match(read('App.jsx'), /dict: pairsRef\.current\.dict/);
    assert.match(read('components/PillWindow.jsx'), /parsePairsText/);
    const srv = readFileSync(join(process.cwd(), 'server', 'index.js'), 'utf8');
    assert.match(srv, /req\.body\?\.dict/);
  });

  it('Settings: импорт словаря из файла (H-01)', () => {
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /type="file"/);
    assert.match(st, /Импорт из файла/);
    assert.match(st, /mergeIntoText/);
    assert.match(st, /DICT_TEMPLATE/);
  });

  it('пилюля самолечится: любые ошибки не оставляют висящее окно', () => {
    const pill = read('components/PillWindow.jsx');
    assert.match(pill, /unhandledrejection/);
    assert.match(pill, /finally/);
    // hide в finally, но хвост старой сессии не прячет новую запись
    assert.match(pill, /if \(!recordingRef\.current\) desktopAPI\.hidePill\(\)/);
  });

  it('ASR: модели Gemini актуальны (не 1.5/2.0 — они отозваны)', () => {
    for (const f of [
      join(process.cwd(), 'electron', 'ai.js'),
      join(process.cwd(), 'electron', 'main.js'),
      join(process.cwd(), 'server', 'index.js'),
      join(process.cwd(), 'scripts', 'flow-cli.mjs'),
    ]) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /gemini-(1\.5|2\.0)-flash/, `${f}: устаревшая модель`);
      assert.match(src, /gemini-flash-latest|GEMINI_MODEL/, `${f}: нет актуальной модели`);
    }
  });

  it('ключ Gemini берётся из настроек, не только из env', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /resolveGeminiKey/);
    assert.match(mj, /geminiKey: ''/);
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /Ключ Gemini для резервного распознавания/);
  });

  it('переназначение клавиш: либа + UI + main + App', () => {
    assert.match(read('lib/hotkey.js'), /DEFAULT_HOTKEY/);
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /HotkeyCard/);
    assert.match(st, /hotkeyFromEvent/);
    assert.match(read('App.jsx'), /hotkeyMatches/);
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /toElectronAccelerator/);
  });

  it('фоновый режим: трей-жизнь, старт в трей, автозапуск', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /backgroundMode: true/);
    assert.match(mj, /startToTray: false/);
    assert.match(mj, /app:login-item:get/);
    assert.match(mj, /setLoginItemSettings/);
    const pl = readFileSync(join(process.cwd(), 'electron', 'preload.cjs'), 'utf8');
    assert.match(pl, /getLoginItem/);
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /BackgroundCard/);
    assert.match(st, /Работать в фоне/);
  });

  it('голосовые команды/ёфикация доезжают до форматтера (App/пилюля/сервер)', () => {
    for (const f of ['App.jsx', 'components/PillWindow.jsx']) {
      const s = read(f);
      assert.match(s, /voiceCommands/, `${f}: voiceCommands`);
      assert.match(s, /restoreYo/, `${f}: restoreYo`);
    }
    const srv = readFileSync(join(process.cwd(), 'server', 'index.js'), 'utf8');
    assert.match(srv, /restoreYo: !!req\.body\?\.restoreYo/);
  });

  it('авто-язык: whisper без -l, Gemini сам определяет, селектор в UI', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /lang !== 'auto'/);
    assert.match(mj, /Определи язык аудио самостоятельно/);
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /Язык распознавания/);
    assert.match(st, /'auto'/);
  });

  it('черновик (Scratchpad): вкладка + автосохранение', () => {
    assert.match(read('components/ScratchpadTab.jsx'), /flow-scratchpad-v1/);
    assert.match(read('components/Sidebar.jsx'), /Черновик/);
    assert.match(read('App.jsx'), /ScratchpadTab/);
  });

  it('экспорты истории: Markdown и JSON рядом с CSV', () => {
    const h = read('components/HistoryTab.jsx');
    assert.match(h, /exportMarkdown/);
    assert.match(h, /exportJSON/);
    assert.match(
      readFileSync(join(process.cwd(), 'src', 'lib', 'journal.js'), 'utf8'),
      /export function exportMarkdown/
    );
  });

  it('packaging: весь src/lib в asar (фикс ERR_MODULE_NOT_FOUND)', () => {
    const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    assert.match(pkg, /src\/lib\/\*\*\/\*/);
  });

  it('пилюля: каждое появление = новая запись, зомби-состояние прячется', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /flow:command', 'start'/); // main шлёт start при каждом показе
    assert.doesNotMatch(mj, /pendingStart/); // мёртвый флаг удалён
    const pill = read('components/PillWindow.jsx');
    assert.match(pill, /cmd === 'start'/); // рендерер рестартует
    assert.match(pill, /desktopAPI\.hidePill\(\); \/\/ зомби/); // не-идущее состояние → hide
    assert.match(pill, /const restart = /);
  });

  it('ASR: честные причины отказа (429/ключ/сеть) вместо общего текста', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /лимит Gemini исчерпан/);
    assert.match(mj, /ключ отклонён/);
    assert.match(mj, /Не распознал: /);
    assert.match(mj, /error: 'no-key'/);
  });

  it('подсказки хоткея динамические (единый Keycaps), а не Alt+Space везде', () => {
    assert.ok(existsSync(join(process.cwd(), 'src', 'components', 'Keycaps.jsx')), 'Keycaps.jsx есть');
    const app = read('App.jsx');
    assert.match(app, /hotkey={settings\.hotkey}/); // Sidebar + Pill + Onboarding
    for (const f of [
      'components/DictationTab.jsx',
      'components/TodayList.jsx',
      'components/Onboarding.jsx',
    ]) {
      const src = read(f);
      assert.match(src, /Keycaps/, `${f}: Keycaps`);
      assert.doesNotMatch(src, /keycap">Alt<|keycap ml-1">Alt</, `${f}: захардкоженный Alt`);
    }
    const pill = read('components/DictationPill.jsx');
    assert.match(pill, /hotkeyParts/);
    const sb = read('components/Sidebar.jsx');
    assert.match(sb, /hotkey \|\| 'Alt\+Space'/);
  });

  it('тогл записи детерминированный: видимость окна, stop → мгновенный hide', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /if \(!pill\.isVisible\(\)\) \{\n    showPill/);
    assert.match(mj, /flow:command', 'stop'/);
    assert.match(mj, /pill\.hide\(\); \/\/ мгновенно/);
    assert.match(mj, /refreshTray/); // подпись трея следует за хоткеем
    assert.match(mj, /Диктовать \(\$\{hk\}\)/);
    const pill = read('components/PillWindow.jsx');
    assert.match(pill, /хвост старой сессии не прячет окно новой записи/);
    assert.match(pill, /hideDelay = 250/); // успех → прятать сразу
  });

  it('словарь — один объединённый проход (H-07/H-08, рекомендация организаторов)', () => {
    const f = read('lib/formatter.js');
    assert.match(f, /buildCombinedMatcher/);
    assert.doesNotMatch(f, /function applyOneMap/); // циклы по картам убраны
  });

  it('V: сервер не ретранслирует клиентские ключи (открытый прокси закрыт)', () => {
    const srv = readFileSync(join(process.cwd(), 'server', 'index.js'), 'utf8');
    assert.doesNotMatch(srv, /headers\['x-api-key'\]/);
    assert.match(srv, /ключей клиентов не ретранслируются|без ретрансляции клиентских ключей/);
  });

  it('AN: eslint + prettier + coverage настроены и в CI', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    for (const script of ['lint', 'format:check', 'coverage']) assert.ok(pkg.scripts[script], script);
    assert.ok(existsSync(join(process.cwd(), '.eslintrc.json')));
    assert.ok(existsSync(join(process.cwd(), '.prettierrc.json')));
    const ci = readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');
    assert.match(ci, /npm run lint/);
    assert.match(ci, /npm run coverage/);
    assert.match(ci, /name: coverage/); // артефакт отчёта (AB-16)
  });

  it('B-15/B-07/B-06: профиль настроек — экспорт/импорт/сброс/санитизация', () => {
    assert.match(read('lib/profile.js'), /PORTABLE_KEYS/);
    const st = read('components/SettingsTab.jsx');
    assert.match(st, /Экспортировать профиль/);
    assert.match(st, /Импортировать профиль/);
    assert.match(st, /Сбросить настройки/);
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /sanitizeSettings/);
    assert.match(mj, /aiTimeoutMs/); // AM-18
  });

  it('B-11/D-05/D-15: трей-статус, конфликт хоткея, хоткей стиля', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /pill:status/);
    assert.match(mj, /flow:hotkey-conflict/);
    assert.match(mj, /cycleStyleMode/);
    assert.match(mj, /STYLE_CYCLE/);
    const pl = readFileSync(join(process.cwd(), 'electron', 'preload.cjs'), 'utf8');
    assert.match(pl, /onHotkeyConflict/);
    assert.match(pl, /setStatus/);
  });

  it('L-01/AM-06: буфер сохраняется и восстанавливается после вставки (без гонки)', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /clipboardBackup/);
    assert.match(mj, /clipboard\.readText/);
    assert.match(mj, /setTimeout\(\(\) => \{\s*try \{\s*clipboard\.writeText\(clipboardBackup\.text\)/);
  });

  it('AM-03: умный пробел между подряд идущими репликами', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /lastInsert/);
  });

  it('AK: оригинальная фича «Проверка вслух» — модуль, тесты, настройка, README', () => {
    assert.ok(existsSync(join(process.cwd(), 'src', 'lib', 'voicecheck.js')));
    assert.ok(existsSync(join(process.cwd(), 'tests', 'profile-voicecheck.test.js')));
    assert.match(read('components/SettingsTab.jsx'), /Проверка вслух/);
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
    assert.match(readme, /Проверка вслух/);
    assert.doesNotMatch(readme, /Демо RU\/EN/); // документация не опережает код (AC-03)
  });

  it('надёжность ASR: фолбэк-цепочка моделей Gemini (429/404 → следующая)', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /ASR_MODELS/);
    assert.match(mj, /фолбэк на/);
  });

  it('сервер: валидация входа, лимит тела, простой query-парсер (AN-07/AN-08)', () => {
    const srv = readFileSync(join(process.cwd(), 'server', 'index.js'), 'utf8');
    assert.match(srv, /поле text должно быть строкой/);
    assert.match(srv, /limit: '8mb'/);
    assert.match(srv, /query parser', 'simple'/);
  });

  it('O-05/O-13: диск полон и занятый порт обработаны', () => {
    const mj = readFileSync(join(process.cwd(), 'electron', 'main.js'), 'utf8');
    assert.match(mj, /tmp write failed \(disk\?\)/);
    const srv = readFileSync(join(process.cwd(), 'server', 'index.js'), 'utf8');
    assert.match(srv, /EADDRINUSE/);
  });

  it('Onboarding: 3 шага и флаг onboarded', () => {
    const ob = read('components/Onboarding.jsx');
    assert.match(ob, /ШАГ/);
    assert.match(ob, /getUserMedia/);
    assert.match(ob, /onboarded|onDone/);
  });
});
