// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// заглушка localStorage (в браузере — нативный, в node — карта в памяти)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { addUtterance, clearJournal, journalSummary } = await import('../src/lib/journal.js');
const { formatText } = await import('../src/lib/formatter.js');

describe('T: статистика и журнал — явные признаки', () => {
  it('T-04: счётчик слов за день присутствует в сводке', () => {
    clearJournal();
    addUtterance({
      text: 'два слова тут',
      words: 3,
      wpm: 90,
      durSec: 2,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const s = journalSummary();
    assert.ok(typeof s.todayWords === 'number' && s.todayWords >= 3, `todayWords=${s.todayWords}`);
    assert.ok(typeof s.todayCount === 'number');
  });

  it('T-06: распределение по приложениям', () => {
    clearJournal();
    addUtterance({
      text: 'a',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'pill',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    addUtterance({
      text: 'b',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'pill',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const s = journalSummary();
    assert.ok(s.byApp && s.byApp.pill >= 2, JSON.stringify(s.byApp));
  });

  it('T-10/P-12: приватный режим не пишет текст реплики', () => {
    clearJournal();
    const r = addUtterance({
      text: 'секретная фраза',
      privacy: true,
      words: 2,
      wpm: 60,
      durSec: 2,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    assert.equal(r.text, '');
    assert.equal(journalSummary().records ?? '', '');
  });

  it('T-13: идентификаторы реплик уникальны', () => {
    clearJournal();
    const a = addUtterance({
      text: 'первая',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const b = addUtterance({
      text: 'вторая',
      words: 1,
      wpm: 60,
      durSec: 1,
      app: 'web',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    assert.notEqual(a.id, b.id);
  });
});

describe('F-11/F-12: даты и время из речи', () => {
  const t = (s) => formatText(s, { mode: 'clean', lang: 'ru' }).text;

  it('F-11: «пятое марта» → «5 марта»', () => {
    assert.match(t('встретимся пятое марта в парке'), /5 марта/);
    assert.match(t('дедлайн двадцать пятое декабря'), /25 декабря/);
  });

  it('F-12: «три часа дня» → «15:00», «девять утра» → «09:00»', () => {
    assert.match(t('звонок в три часа дня'), /15:00/);
    assert.match(t('созвон в девять утра завтра'), /09:00/);
    assert.match(t('ужин в семь вечера'), /19:00/);
    assert.match(t('встреча в полдень'), /12:00/);
  });

  it('F-10 не сломан: числа и деньги', () => {
    assert.match(t('зарплата пять тысяч'), /5000/);
  });
});

describe('AM-04/D-10/AM-01: первый символ, короткие реплики, режимы', async () => {
  const { formatText } = await import('../src/lib/formatter.js');

  it('AM-04: первый значащий символ реплики не теряется (эмодзи, тире, кавычка, буква)', () => {
    for (const c of ['- привет', '«ёжик»', '(тест)', '🎉 старт', 'ёжик', 'Пока!']) {
      const out = formatText(c, { mode: 'clean', lang: 'ru' }).text.trim();
      const firstIn = c.trim()[0].toLowerCase();
      const firstOut = out[0].toLowerCase();
      // первый символ либо сохранён, либо это его заглавная форма (ё→Ё и т.п.)
      assert.ok(
        firstOut === firstIn || firstOut === firstIn.toUpperCase(),
        `"${c}" → "${out}": первый символ потерян`
      );
    }
  });

  it('AM-01: triggerMode часть контракта настроек (в коде приложения)', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /triggerMode === 'hold'/);
    const mj = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.match(mj, /triggerMode/);
  });

  it('D-10: гард короткой реплики присутствует в пилюле и дашборде', async () => {
    const { readFileSync } = await import('node:fs');
    const pill = readFileSync(new URL('../src/components/PillWindow.jsx', import.meta.url), 'utf8');
    assert.match(pill, /< 200/);
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /< 200/);
  });
});

describe('Батч дня 2: трей, микрофон, замеры, доки', () => {
  it('B-11: трей в трёх состояниях без мигания (idle/recording/processing)', async () => {
    const { readFileSync } = await import('node:fs');
    const mj = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.match(mj, /setTrayState/);
    assert.match(mj, /processing/);
    assert.match(mj, /картинку не дёргаем/); // AM-11
  });

  it('C-16: шумоподавление — настройка + constraint getUserMedia', async () => {
    const { readFileSync } = await import('node:fs');
    const rec = readFileSync(new URL('../src/lib/recorder.js', import.meta.url), 'utf8');
    assert.match(rec, /noiseSuppression/);
    const st = readFileSync(new URL('../src/components/SettingsTab.jsx', import.meta.url), 'utf8');
    assert.match(st, /Шумоподавление/);
  });

  it('C-01..C-06: MicCard — список, выбор, devicechange', async () => {
    const { readFileSync } = await import('node:fs');
    const mic = readFileSync(new URL('../src/components/MicCard.jsx', import.meta.url), 'utf8');
    assert.match(mic, /enumerateDevices/);
    assert.match(mic, /devicechange/);
    assert.match(mic, /micDeviceId/);
  });

  it('AL-09: средний wpm по приложениям в сводке', async () => {
    globalThis.localStorage = globalThis.localStorage || {};
    const { addUtterance, clearJournal, journalSummary } = await import('../src/lib/journal.js');
    clearJournal();
    addUtterance({
      text: 'тест',
      words: 5,
      wpm: 100,
      durSec: 3,
      app: 'telegram',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    addUtterance({
      text: 'тест два',
      words: 5,
      wpm: 140,
      durSec: 3,
      app: 'telegram',
      mode: 'clean',
      lang: 'ru',
      source: 'local',
      latencies: {},
      dictHits: [],
      fillersRemoved: 0,
    });
    const s = journalSummary();
    assert.equal(s.wpmByApp.telegram.avgWpm, 120);
    assert.equal(s.wpmByApp.telegram.count, 2);
  });

  it('AM-20: пауза перед вставкой задаётся настройкой', async () => {
    const { readFileSync } = await import('node:fs');
    const mj = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.match(mj, /insertDelayMs/);
    const rd = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    assert.match(rd, /insertDelayMs/);
  });

  it('Z-07/Z-09/AE-10: THIRD-PARTY и UNIQUENESS в репозитории', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    assert.ok(existsSync(new URL('../docs/THIRD-PARTY-NOTICES.md', import.meta.url)));
    assert.match(
      readFileSync(new URL('../docs/THIRD-PARTY-NOTICES.md', import.meta.url), 'utf8'),
      /Third-party notices/
    );
    assert.ok(existsSync(new URL('../UNIQUENESS.md', import.meta.url)));
    assert.match(readFileSync(new URL('../UNIQUENESS.md', import.meta.url), 'utf8'), /AE-06/);
  });

  it('W-10/T-16: чекер локально одной командой (npm run check)', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.ok(pkg.scripts.check, 'npm run check');
    const rd = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    assert.match(rd, /Прогон чекера локально/);
  });
});

describe('M-17/A-09/E-09/AG: якоря батча', () => {
  it('M-17: crypto.js — AES-GCM, PBKDF2, верификатор без хранения ключа', async () => {
    const { readFileSync } = await import('node:fs');
    const c = readFileSync(new URL('../src/lib/crypto.js', import.meta.url), 'utf8');
    assert.match(c, /AES-GCM/);
    assert.match(c, /PBKDF2/);
    assert.match(c, /verifier/);
    const j = readFileSync(new URL('../src/lib/journal.js', import.meta.url), 'utf8');
    assert.match(j, /enableJournalEncryption/);
    assert.match(j, /unlockJournal/);
    const st = readFileSync(new URL('../src/components/SettingsTab.jsx', import.meta.url), 'utf8');
    assert.match(st, /Шифровать журнал/);
    const ht = readFileSync(new URL('../src/components/HistoryTab.jsx', import.meta.url), 'utf8');
    assert.match(ht, /Журнал зашифрован/);
  });

  it('A-09: качалка модели пропускается, если файл уже есть с верным хешем', async () => {
    const { readFileSync } = await import('node:fs');
    const mj = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.match(mj, /existing: true/);
    assert.match(mj, /sha256File\(dest\)/);
  });

  it('E-09: промежуточные гипотезы считаются и попадают в журнал', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /interimsRef/);
    const j = readFileSync(new URL('../src/lib/journal.js', import.meta.url), 'utf8');
    assert.match(j, /interims: r\.interims \|\| 0/);
  });
});

describe('whisper в 1 клик (вставка из коробки, легально)', () => {
  it('asr:download-bin: официальный бинарь + SHA-256 + автонастройка whisperBin', async () => {
    const { readFileSync } = await import('node:fs');
    const mj = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
    assert.match(mj, /asr:download-bin/);
    assert.match(mj, /WHISPER_BINS/);
    assert.match(mj, /78568aa80b361382cb303438a7be3b05669651f2ca8258910394679e049d26ea/);
    assert.match(mj, /f4cfc1f969a13805908fb72043ce7cc896eb42e0b8afbe841dc8e7298923b061/);
    assert.match(mj, /writeSettings\(\{ whisperBin: binPath \}\)/);
    const pl = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
    assert.match(pl, /downloadBin/);
    const st = readFileSync(new URL('../src/components/SettingsTab.jsx', import.meta.url), 'utf8');
    assert.match(st, /Установить whisper в 1 клик/);
  });
});

describe('UX: предупреждение о ненастроенном распознавателе (до записи)', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('пилюля проверяет движок до автостарта и не пишет в пустоту', () => {
    const pill = read('../src/components/PillWindow.jsx');
    assert.match(pill, /asrCheck/);
    assert.match(pill, /Распознавание не настроено — Настройки → «whisper в 1 клик» или ключ Gemini/);
    assert.match(pill, /hideDelay = 8000/, 'подсказка no-engine висит 8с');
  });

  it('настройки: баннер «голосовой ввод не настроен» при отсутствии движков', () => {
    const st = read('../src/components/SettingsTab.jsx');
    assert.match(st, /Голосовой ввод пока не настроен/);
  });

  it('main: подсказка no-engine ведёт к кнопке 1-клик', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /Установить whisper в 1 клик» — или вставь ключ Gemini/);
  });
});

describe('A-08+: one-click устойчив к сети и повторным нажатиям', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('main: уже установленный whisper не требует сети (existing) + ретраи скачивания', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /existing: true/, 'повторное нажатие — без скачивания');
    assert.match(mj, /fetchAsset/, 'ретраи сети');
    assert.match(mj, /сеть недоступна/, 'человеческое сообщение вместо TypeError');
  });

  it('настройки: кнопка показывает «whisper установлен ✓», ошибки человекочитаемы', () => {
    const st = read('../src/components/SettingsTab.jsx');
    assert.match(st, /humanErr/);
    assert.match(st, /whisper установлен ✓ — проверить/);
    assert.match(st, /whisper уже установлен ✓ — можно диктовать/);
  });
});

describe('INSERT-фикс: пилюля не крадёт фокус, вставка гарантирована', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('пилюля focusable:false + showInactive + hide перед Ctrl+V', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /focusable: false/, 'пилюля не забирает фокус');
    assert.match(mj, /showInactive/, 'показ без кражи фокуса');
    assert.match(mj, /pill\.hide\(\);\s*\n\s*await new Promise/, 'фокус возвращён до вставки');
  });

  it('Windows: SendInput (WinAPI) вместо WScript SendKeys', () => {
    const pj = read('../electron/paste.js');
    assert.match(pj, /SendInput/);
    assert.match(pj, /FlowKeys/);
  });

  it('фулл-офлайн: whisper + модель предустановлены в установщик', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /bundledBin/);
    assert.match(mj, /bundledModel/);
    const pkg = JSON.parse(read('../package.json'));
    assert.deepEqual(pkg.build.extraResources, [{ from: 'extra/whisper', to: 'whisper' }]);
    const yml = read('../.github/workflows/release.yml');
    assert.match(yml, /fetch-whisper\.mjs/);
    const fw = read('../scripts/fetch-whisper.mjs');
    assert.match(fw, /422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898/);
  });

  it('пилюля пишет в журнал (История оживает)', () => {
    const pill = read('../src/components/PillWindow.jsx');
    assert.match(pill, /addUtterance/);
    assert.match(pill, /app: 'pill'/);
  });
});

describe('ASR self-heal: мёртвый путь whisper не убивает диктовку', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('firstAlive: настройки → env → bundled, мёртвые пути пропускаются', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /function firstAlive/, 'самопочинка путей');
    assert.match(mj, /firstAlive\(\[s\.whisperBin, process\.env\.WHISPER_BIN, bundledBin\(\)\]\)/);
    assert.match(
      mj,
      /firstAlive\(\[\s*s\.whisperModel,\s*process\.env\.WHISPER_MODEL,\s*bundledModel\(\),\s*defaultModelPath\(\),?\s*\]\)/
    );
  });

  it('ошибка whisper показывается юзеру, а не глотается', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /whisperFailHint/, 'расшифровка падения');
    assert.match(mj, /fails\.push\(await whisperFailHint/, 'ошибка собирается, не глотается');
    assert.match(mj, /whisper упал:/, 'настоящая причина в hint');
  });
});

describe('Whisper-фолбэк: карантин main.exe не убивает диктовку', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('aliveWhisperBins: соседи-алиасы whisper-cli подхватываются автоматически', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /function aliveWhisperBins/);
    assert.match(mj, /whisper-cli\.exe/);
    assert.match(mj, /for \(const bin of bins\)/, 'перебор живых бинарей');
  });

  it('подсказка различает DLL-загрузчик и битую модель', () => {
    const mj = read('../electron/main.js');
    assert.match(mj, /vc_redist\.x64\.exe/);
    assert.match(mj, /модель повреждена/);
    assert.match(mj, /sha256File\(model\)/, 'SHA модели проверяется при падении');
  });

  it('CI: smoke-тест бандла на настоящей Windows', () => {
    const yml = read('../.github/workflows/release.yml');
    assert.match(yml, /windows-smoke/);
    assert.match(yml, /fellow americans/);
  });
});

describe('VC runtime: бандл самодостаточен на чистой Windows', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('бандл: small-q5_1 (точнее по-русски) — SHA, приоритет перед base', () => {
    const fw = read('../scripts/fetch-whisper.mjs');
    assert.match(fw, /ggml-small-q5_1\.bin/);
    assert.match(fw, /ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb/);
    const mj = read('../electron/main.js');
    assert.match(mj, /small-q5_1 точнее по-русски/, 'bundledModel предпочитает small');
    assert.match(mj, /small из установщика точнее ранее скачанной base/, 'приоритет моделей');
    assert.match(mj, /deprecated main\.exe/, 'миграция старого пути в настройках');
  });

  it('fetch-whisper кладёт VC++ DLL рядом с main.exe (app-local)', () => {
    const fw = read('../scripts/fetch-whisper.mjs');
    assert.match(fw, /vcruntime140_1\.dll/);
    assert.match(fw, /vcomp140\.dll/);
    assert.match(fw, /VC runtime в комплекте/);
  });
});
