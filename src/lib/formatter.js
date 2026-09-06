// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Smart local formatter — «магия Wispr Flow» без единого API-ключа.
 * Убирает слова-паразиты, расставляет пунктуацию (в т.ч. по голосовым командам
 * «точка», «запятая», «новая строка»), исправляет регистр и стилизует
 * текст под выбранный режим (clean / email / bullets / chat / code).
 *
 * NB: `\b` в JS-регэкспах не работает с кириллицей, поэтому везде
 * используются lookaround-границы по классам Unicode (\p{L}, \p{N}).
 */

const RU = {
  fillers: [
    'эм',
    'ээм',
    'эээ',
    'э-э',
    'мм',
    'ммм',
    'м-м',
    'ну',
    'вот',
    'типа',
    'как бы',
    'это самое',
    'как его',
    'короче',
    'в общем',
    'скажем так',
    'как сказать',
    'ага',
    'угу',
    'ну вот',
  ],
  spokenPunct: [
    ['точка с запятой', ';'],
    ['вопросительный знак', '?'],
    ['восклицательный знак', '!'],
    ['открыть кавычки', '«'],
    ['закрыть кавычки', '»'],
    ['с нового абзаца', '\n\n'],
    ['новый абзац', '\n\n'],
    ['абзац', '\n\n'],
    ['с новой строки', '\n'],
    ['новая строка', '\n'],
    ['перенос строки', '\n'],
    ['двоеточие', ':'],
    ['тире', '—'],
    ['дефис', '-'],
    ['многоточие', '…'],
    ['знак вопроса', '?'],
    ['знак восклицания', '!'],
    ['запятая', ','],
    ['точка', '.'],
    ['точка', '.'],
    ['запятая', ','],
  ],
  commaBefore: [
    'но',
    'зато',
    'однако',
    'потому что',
    'так как',
    'который',
    'которая',
    'которое',
    'которые',
    'чтобы',
    'хотя',
    'ведь',
    'что',
    'а',
    'когда',
  ],
  // перед «что» не ставим запятую внутри устойчивых связок
  commaGuard: { что: ['потому '] },
  breakWords: ['потом', 'дальше', 'также', 'кстати', 'в итоге', 'кроме того', 'плюс ко всему'],
  emailGreeting: 'Добрый день!',
  emailSignature: 'С уважением',
};

const EN = {
  fillers: ['um', 'uhm', 'uh', 'erm', 'hmm', 'you know', 'i mean', 'sort of', 'kind of', 'basically'],
  spokenPunct: [
    ['question mark', '?'],
    ['exclamation mark', '!'],
    ['exclamation point', '!'],
    ['full stop', '.'],
    ['period', '.'],
    ['comma', ','],
    ['colon', ':'],
    ['semicolon', ';'],
    ['dash', '—'],
    ['hyphen', '-'],
    ['ellipsis', '…'],
    ['new line', '\n'],
    ['newline', '\n'],
    ['new paragraph', '\n\n'],
    ['open quote', '“'],
    ['close quote', '”'],
  ],
  commaBefore: ['but', 'however', 'because', 'which', 'although', 'so that'],
  breakWords: ['then', 'also', 'by the way', 'after that', 'anyway'],
  emailGreeting: 'Hi there!',
  emailSignature: 'Best regards',
};

const TECH_TERMS = [
  'react',
  'vue',
  'angular',
  'node',
  'express',
  'python',
  'javascript',
  'typescript',
  'postgres',
  'postgresql',
  'mongodb',
  'redis',
  'tailwind',
  'webpack',
  'docker',
  'kubernetes',
  'github',
  'websocket',
  'openai',
  'gemini',
  'typescript',
  'vite',
  'vercel',
  'kafka',
  'graphql',
  'rust',
  'golang',
];

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).filter(Boolean).length : 0);

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Границы слова, работающие и с кириллицей, и с латиницей */
const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// Нормализация чисел, денег, времени, контактов (F-10..F-19)
// ---------------------------------------------------------------------------
const NUM_WORDS = {
  ноль: 0,
  один: 1,
  одна: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
  тысяча: 1000,
  тысячи: 1000,
  тысяч: 1000,
  миллион: 1e6,
  миллиона: 1e6,
  миллионов: 1e6,
};

/** «двадцать пять» → 25, «две тысячи пятьсот» → 2500. Возврат: [число, слов-в-группе] */
export function parseRuNumber(tokens, start) {
  let total = 0;
  let acc = 0;
  let count = 0;
  let i = start;
  while (i < tokens.length) {
    const t = String(tokens[i] || '').toLowerCase();
    const v = NUM_WORDS[t];
    if (v === undefined) break;
    count += 1;
    i += 1;
    if (v >= 1000) {
      total += (acc || 1) * v;
      acc = 0;
    } else {
      acc += v;
    }
  }
  if (!count) return null;
  return [total + acc, count];
}

/** Слова-числа → цифры (F-10). Одиночные «один/одна» не трогаем (часто не про счёт). */
const NUM_KEYS = Object.keys(NUM_WORDS).map(esc).join('|');
const NUM_SEQ_RE = new RegExp(`${L}(?:${NUM_KEYS})(?:\\s+(?:${NUM_KEYS}))*${R}`, 'giu');

function normalizeNumbers(text) {
  return text.replace(NUM_SEQ_RE, (m) => {
    const words = m.trim().split(/\s+/);
    if (words.length === 1 && (words[0].toLowerCase() === 'один' || words[0].toLowerCase() === 'одна')) {
      return m;
    }
    const parsed = parseRuNumber(words, 0);
    return parsed ? String(parsed[0]) : m;
  });
}

// F-11: «пятое марта» → «5 марта», «двадцать пятое декабря» → «25 декабря»
const RU_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const RU_ORDINALS = {
  первое: 1,
  второе: 2,
  третье: 3,
  четвёртое: 4,
  четвертое: 4,
  пятое: 5,
  шестое: 6,
  седьмое: 7,
  восьмое: 8,
  девятое: 9,
  десятое: 10,
  одиннадцатое: 11,
  двенадцатое: 12,
  тринадцатое: 13,
  четырнадцатое: 14,
  пятнадцатое: 15,
  шестнадцатое: 16,
  семнадцатое: 17,
  восемнадцатое: 18,
  девятнадцатое: 19,
  двадцатое: 20,
  'двадцать первое': 21,
  'двадцать второе': 22,
  'двадцать третье': 23,
  'двадцать четвёртое': 24,
  'двадцать четвертое': 24,
  'двадцать пятое': 25,
  'двадцать шестое': 26,
  'двадцать седьмое': 27,
  'двадцать восьмое': 28,
  'двадцать девятое': 29,
  тридцатое: 30,
  'тридцать первое': 31,
};

function normalizeDates(text) {
  const monthsAlt = RU_MONTHS.join('|');
  const ordinalsAlt = Object.keys(RU_ORDINALS)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const re = new RegExp(`(${ordinalsAlt})\\s+(${monthsAlt})`, 'gi');
  return text.replace(re, (m, ord, mon) => {
    const day = RU_ORDINALS[ord.toLowerCase()];
    if (!day) return m;
    return `${day} ${mon.toLowerCase()}`;
  });
}

// F-12: «три часа дня» → «15:00», «девять утра» → «09:00», «полдень» → «12:00»
function normalizeTimeOfDay(text) {
  let out = text.replace(/полдень/gi, '12:00');
  const numWord = {
    один: 1,
    одна: 1,
    два: 2,
    две: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
    восемь: 8,
    девять: 9,
    десять: 10,
    одиннадцать: 11,
    двенадцать: 12,
  };
  const numsAlt = Object.keys(numWord).join('|');
  const re = new RegExp(`(${numsAlt})\\s+час(?:а|ов)?\\s+(дня|ночи|утра|вечера)`, 'gi');
  out = out.replace(re, (m, numWordRaw, part) => {
    const h = numWord[numWordRaw.toLowerCase()];
    if (!h) return m;
    const offset = part.toLowerCase() === 'дня' || part.toLowerCase() === 'вечера' ? 12 : 0;
    const hh = ((h - 1 + offset) % 24) + 1;
    return `${String(hh).padStart(2, '0')}:00`;
  });
  // «в 3 часа дня» / «3 часа дня» (уже цифрой)
  out = out.replace(/(\b\d{1,2})\s+час(?:а|ов)?\s+(дня|ночи|утра|вечера)/gi, (m, num, part) => {
    const h = Number(num);
    if (!Number.isFinite(h) || h < 1 || h > 12) return m;
    const offset = part.toLowerCase() === 'дня' || part.toLowerCase() === 'вечера' ? 12 : 0;
    const hh = ((h - 1 + offset) % 24) + 1;
    return `${String(hh).padStart(2, '0')}:00`;
  });
  // «3:00 дня» / «9:30 вечера» — модель отдала цифры с половиной суток
  out = out.replace(/\b(\d{1,2}):(\d{2})\s+(дня|вечера)/gi, (m, hh, mm, part) => {
    let h = Number(hh);
    if (!Number.isFinite(h) || h < 1 || h > 12) return m;
    if (part.toLowerCase() === 'дня' || part.toLowerCase() === 'вечера') h += 12;
    return `${String(h % 24).padStart(2, '0')}:${mm}`;
  });
  // «в девять утра» / «пять вечера» — без слова «час»
  out = out.replace(new RegExp(`(в )?(${numsAlt})\\s+(утра|вечера|дня|ночи)`, 'gi'), (m, v, numRaw, part) => {
    const h = numWord[numRaw.toLowerCase()];
    if (!h) return m;
    const offset = part.toLowerCase() === 'дня' || part.toLowerCase() === 'вечера' ? 12 : 0;
    const hh = ((h - 1 + offset) % 24) + 1;
    return `${v || ''}${String(hh).padStart(2, '0')}:00`;
  });
  return out;
}

// ASR-выхлоп: «5.000 руб» — точка как группировка разрядов склеивается
function normalizeDotGroups(text) {
  return text.replace(/\b(\d{1,3})\.(\d{3})\b(?![\d])/g, '$1$2');
}

function normalizeDomainsEmailsPhones(text) {
  let out = text;
  // F-16: email «бро собака почта точка ру» → бро@почта.ру
  out = out.replace(
    /([\p{L}\p{N}._-]+)\s+собака\s+([\p{L}\p{N}-]+)\s+точка\s+([\p{L}]{2,})(?![\p{L}\p{N}])/giu,
    (_m, a, b, c) => `${a}@${b}.${c.toLowerCase()}`
  );
  // F-17: домен «приложение точка ру» → приложение.ру (латиница/цифры слева)
  out = out.replace(
    /([A-Za-z0-9][A-Za-z0-9-]*)\s+точка\s+(ru|com|org|net|io|ai|dev|рф)(?![\p{L}\p{N}])/giu,
    (_m, a, b) => `${a}.${b.toLowerCase()}`
  );
  // F-15: подряд одиночных цифр (телефон) склеиваем: «8 9 1 7 …» → 8917…
  out = out.replace(new RegExp(`${L}\\d(?:\\s+\\d){4,}${R}`, 'gu'), (m) => m.replace(/\s+/g, ''));
  // F-18: 2+ одиночные ЛАТИНСКИЕ буквы подряд → аббревиатура капсом: «а пи ай» → API
  // (кириллические одиночные буквы — союзы и предлоги, их трогать нельзя)
  out = out.replace(/(?<![A-Za-z])([A-Za-z])(?:\s+([A-Za-z])){1,7}(?![A-Za-z])/g, (m) => {
    const letters = m.trim().split(/\s+/);
    if (!letters.every((w) => w.length === 1)) return m;
    return letters.join('').toUpperCase();
  });
  return out;
}

function normalizeQuantities(text) {
  let out = text;
  const end = '(?![\\p{L}])';
  // деньги F-13
  out = out.replace(new RegExp(`(\\d+)\\s*(рубля|рублей|рубль|руб)${end}`, 'giu'), '$1 ₽');
  out = out.replace(new RegExp(`(\\d+)\\s*(доллара|долларов|доллар)${end}`, 'giu'), '$1 $');
  out = out.replace(new RegExp(`(\\d+)\\s*евро${end}`, 'giu'), '$1 €');
  // проценты F-14
  out = out.replace(new RegExp(`(\\d+)\\s*(процента|процентов|процент)${end}`, 'giu'), '$1%');
  // время F-12: «в пять часов тридцать минут» → в 05:30
  out = out.replace(/(\d{1,2})\s*час[а-я]*\s*(\d{1,2})\s*минут[а-я]*/giu, (_m, h, m) => {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}`;
  });
  // G-18: неразрывный пробел в единицах
  out = out.replace(
    new RegExp(`(\\d)\\s(кг|г|т|км|м|см|мм|л|мл|ч|мин|сек|шт|руб|%)${end}`, 'giu'),
    '$1\u00A0$2'
  );
  return out;
}

/** F-19: повтор слова подряд снимается: «я я думаю» → «я думаю» */
function collapseRepeats(text) {
  let prev = '';
  let out = text;
  for (let k = 0; k < 3 && prev !== out; k++) {
    prev = out;
    out = out.replace(new RegExp(`${L}([\\p{L}]{2,})(\\s+\\1)+${R}`, 'giu'), '$1');
  }
  return out;
}

/** F-21: самоисправление «… то есть …» — оставляем только исправленную часть */
function applySelfCorrection(text) {
  return text
    .split(/(?<=[.!?…]\s)/)
    .map((s) => {
      const parts = s.split(/,?\s(?:то есть|точнее|то бишь)\s/i);
      return parts.length > 1 ? capitalize(parts[parts.length - 1].trim()) : s;
    })
    .join(' ');
}

// ---------------------------------------------------------------------------
// Словарь терминов (H) и макросы (AJ): case-preserving замены + счётчик.
// Один комбинированный регэксп + кеш по ссылке словаря: 5000 позиций без роста задержки (H-07/H-08).
// ---------------------------------------------------------------------------
const dictCache = new WeakMap();

/**
 * Объединённый матчер ВСЕХ карт (макросы + встроенные термины + пользовательский
 * словарь) в ОДНО регулярное выражение — один проход по тексту на реплику (H-07/H-08:
 * словарь на 5000 позиций обрабатывается без роста задержки). Приоритет: последняя
 * карта побеждает (dict > DEFAULT_TERMS > macros). Кеш по объекту словаря (WeakMap).
 */
export function buildCombinedMatcher(maps) {
  const dictKey = maps[maps.length - 1];
  const cacheable = dictKey && typeof dictKey === 'object';
  const cached = cacheable ? dictCache.get(dictKey) : null;
  if (cached) return cached;
  const lower = new Map();
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (k && v != null) lower.set(String(k).toLowerCase(), String(v));
    }
  }
  if (!lower.size) return null;
  const keys = [...lower.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`${L}(?:${keys.map(esc).join('|')})${R}`, 'giu');
  const matcher = { re, lower };
  if (cacheable) dictCache.set(dictKey, matcher);
  return matcher;
}

// Дефолтные термины: как слышится ← как пишется (пополняется Dictionary-файлом пользователя)
const DEFAULT_TERMS = {
  'а пи ай': 'API',
  джейсон: 'JSON',
  реакт: 'React',
  джаваскрипт: 'JavaScript',
  питон: 'Python',
  гитхаб: 'GitHub',
  джира: 'Jira',
  слак: 'Slack',
  нэйшн: 'Notion',
  'эс эс эс': 'SSS',
  'ю эс эй': 'USA',
  // F-28/I-05: Татарстан и Казань — местные топонимы и имена
  казань: 'Казань',
  казани: 'Казани',
  татарстан: 'Татарстан',
  баумана: 'Баумана',
  кремлевская: 'Кремлёвская',
  тукая: 'Тукая',
  'габдулла тукай': 'Габдулла Тукай',
  челны: 'Челны',
  альметьевск: 'Альметьевск',
  нижнекамск: 'Нижнекамск',
  зилант: 'Зилант',
  'чак-чак': 'чак-чак',
  эчпочмак: 'эчпочмак',
};

/** Одна замена с сохранением регистра первой буквы («тукай» → «Тукай») */
function replaceMatch(m, matcher, hits) {
  const replacement = matcher.lower.get(m.toLowerCase());
  if (replacement === undefined) return m;
  hits.push(m.toLowerCase());
  if (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()) {
    return capitalize(replacement);
  }
  return replacement;
}

/**
 * H + AJ: макросы, встроенные термины и пользовательский словарь применяются
 * за один проход объединённого регулярного выражения (см. buildCombinedMatcher).
 */
function applyDictionary(text, dict, macros) {
  const hits = [];
  const matcher = buildCombinedMatcher([macros, DEFAULT_TERMS, dict]);
  if (!matcher) return { text, hits };
  const out = text.replace(matcher.re, (m) => replaceMatch(m, matcher, hits));
  return { text: out, hits };
}

/** J-13: команда «замени X на Y» */
export function replaceInText(text, from, to) {
  if (!from) return text;
  const re = new RegExp(`${L}${esc(from)}${R}`, 'giu');
  return text.replace(re, to);
}

/** G-10/G-11: «маркированный список»/«нумерованный список» + «далее» как разделитель пунктов.
 *  «далее» становится разделителем только если в тексте есть команда списка. */
function applyListCommands(text) {
  const hasBullets = new RegExp(`${L}маркированный список${R}`, 'iu').test(text);
  const hasNumbered = new RegExp(`${L}нумерованный список${R}`, 'iu').test(text);
  if (!hasBullets && !hasNumbered) return text;

  let out = text.replace(new RegExp(`${L}маркированный список${R}[:,]?`, 'giu'), '\n• ');
  let n = 0;
  out = out.replace(new RegExp(`${L}нумерованный список${R}[:,]?`, 'giu'), () => {
    n = 0;
    return '\n@@NUM@@';
  });
  if (hasNumbered) {
    out = out.replace(/\s+далее\s+/gi, '\n');
    const lines = out.split('\n');
    const res = [];
    let counting = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('@@NUM@@')) {
        counting = true;
        const rest = t.slice(7).trim();
        if (rest) {
          n += 1;
          res.push(`${n}. ${rest}`);
        } else {
          res.push('');
        }
        continue;
      }
      if (counting && t) {
        n += 1;
        res.push(`${n}. ${t}`);
      } else {
        res.push(line);
      }
    }
    out = res.join('\n');
  } else {
    out = out.replace(/\s+далее\s+/gi, '\n• ');
  }
  return out;
}

/** Шаг 1: голосовые команды пунктуации → символы */
function applySpokenPunctuation(text, pack) {
  let out = text;
  for (const [phrase, symbol] of pack.spokenPunct) {
    out = out.replace(new RegExp(`${L}${esc(phrase)}${R}`, 'giu'), ` ${symbol} `);
  }
  return out;
}

/**
 * I-10: смешанные алфавиты. Слово, где кириллица перемешана с латиницей
 * («рaботa», «теgст») — почти всегда ошибка распознавания: латинские
 * двойники заменяются кириллицей, если слово уже содержит кириллицу.
 */
const HOMOGLYPHS = {
  a: 'а',
  c: 'с',
  e: 'е',
  o: 'о',
  p: 'р',
  x: 'х',
  y: 'у',
  i: 'і',
  s: 'ѕ',
  g: 'г',
  k: 'к',
  m: 'м',
  t: 'т',
  b: 'в',
  h: 'н',
};
const MIXED_WORD = /(?=\p{Script=Cyrillic})(?=.*[a-z])(\p{L}+)/giu;
const HAS_CYR = /\p{Script=Cyrillic}/u;
const SOLO_LATIN = /(?<![\p{L}])([aceopyx])(?![\p{L}])/giu;

export function normalizeHomoglyphs(text) {
  // быстрый выход: в тексте нет кириллицы — это английский, ничего не трогаем
  if (!HAS_CYR.test(text)) return text;
  let out = text.replace(MIXED_WORD, (word) =>
    word.replace(/[a-z]/giu, (ch) => HOMOGLYPHS[ch.toLowerCase()] || ch)
  );
  // одиночная латинская буква среди кириллицы («встретимся c тобой») → кириллица
  out = out.replace(SOLO_LATIN, (m, ch) => {
    const repl = HOMOGLYPHS[ch.toLowerCase()];
    return repl ? (ch === ch.toUpperCase() ? repl.toUpperCase() : repl) : m;
  });
  return out;
}

/** AM-19: служебная обвязка моделей не попадает в текст (фенсы, <think>, «Ответ:») */
export function stripModelTags(text) {
  if (!text) return '';
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/i, '')
    .replace(/^\s*(ответ|answer)\s*:\s*/i, '')
    .replace(/\[INST\]|<\|im_start\|>|<\|endoftext\|>/g, '')
    .trim();
}

/** Ёфикация: е → ё в словах, где ё всегда (опция restoreYo) */
const YO_PAIRS = [
  ['еще', 'ещё'],
  ['елка', 'ёлка'],
  ['елки', 'ёлки'],
  ['елке', 'ёлке'],
  ['елку', 'ёлку'],
  ['елок', 'ёлок'],
  ['объем', 'объём'],
  ['объемы', 'объёмы'],
  ['объеме', 'объёме'],
  ['трех', 'трёх'],
  ['четырех', 'четырёх'],
  ['черный', 'чёрный'],
  ['черная', 'чёрная'],
  ['черное', 'чёрное'],
  ['черные', 'чёрные'],
  ['желтый', 'жёлтый'],
  ['желтая', 'жёлтая'],
  ['желтое', 'жёлтое'],
  ['зеленый', 'зелёный'],
  ['зеленая', 'зелёная'],
  ['зеленое', 'зелёное'],
  ['тяжелый', 'тяжёлый'],
  ['тяжелая', 'тяжёлая'],
  ['надежный', 'надёжный'],
  ['надежная', 'надёжная'],
];

function restoreYoLetters(text) {
  let fixed = 0;
  let out = text;
  for (const [from, to] of YO_PAIRS) {
    const re = new RegExp(`${L}(${esc(from)})${R}`, 'giu');
    out = out.replace(re, (m, word) => {
      fixed += 1;
      if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
        return to[0].toUpperCase() + to.slice(1);
      }
      return to;
    });
  }
  return { text: out, fixed };
}

/** Шаг 2: удаление слов-паразитов */
function removeFillers(text, pack) {
  let removed = 0;
  let out = text;
  for (const f of [...pack.fillers].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`${L}${esc(f)}${R}`, 'giu');
    out = out.replace(re, () => {
      removed += 1;
      return ' ';
    });
  }
  return { text: out, removed };
}

/** Шаг 3: чистка пробелов вокруг пунктуации (не разбиваем домены/мейлы: бро@почта.ру) */
function tidyPunctuation(text) {
  return text
    .replace(/«[ \t]+/g, '«')
    .replace(/[ \t]+»/g, '»')
    .replace(/[ \t]+([,.!?;:…])/g, '$1')
    .replace(/([,.!?;:])(?=[^\s\d.,!?;:)])/g, (m, _p, off, str) => {
      if (m === '.') {
        // «почта.ру» / «приложение.ру»: точка между буквами с коротким TLD — не предложение
        const after = str.slice(off + 1).match(/^[\p{L}]{2,3}(?![\p{L}])/u);
        const before = off > 0 ? str[off - 1] : '';
        if (after && /[\p{L}\p{N}@._-]/u.test(before)) return m;
      }
      return m + ' ';
    })
    .replace(/,{2,}/g, ',')
    .replace(/\.{4,}/g, '…')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

/** Шаг 4: расставляем запятые по простым грамматическим правилам */
function insertCommas(text, pack) {
  let out = text;
  const sorted = [...pack.commaBefore].sort((a, b) => b.length - a.length);
  for (const w of sorted) {
    // guard: не ставим запятую внутри связок вида «потому что»
    const guards = (pack.commaGuard && pack.commaGuard[w]) || [];
    const guard = guards.map((g) => `(?<!${esc(g)})`).join('');
    const re = new RegExp(`(?<=[\\p{L}\\d])\\s+${guard}(${esc(w)})(?=\\s)`, 'giu');
    out = out.replace(re, ', $1');
  }
  return out;
}

/** Шаг 5: разбиваем «поток сознания» на предложения (внутри абзаца) */
function sentenceize(paragraph, pack) {
  const out = [];
  // Сначала режем по уже расставленным знакам конца предложения…
  const chunks = paragraph
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // …затем длинные «бесконечные» куски делим по словам-маркерам («потом», «кстати»…)
  for (const chunk of chunks) {
    const words = chunk.split(/[ \t]+/); // берегём nbsp
    let buffer = [];
    for (let i = 0; i < words.length; i++) {
      buffer.push(words[i]);
      const rest = words
        .slice(i + 1, i + 4)
        .join(' ')
        .toLowerCase();
      const isBreak = pack.breakWords.some((b) => rest === b || rest.startsWith(b + ' '));
      if (buffer.length >= 10 && isBreak) {
        out.push(buffer.join(' '));
        buffer = [];
      }
    }
    if (buffer.length) out.push(buffer.join(' '));
  }

  return out
    .map((s) => {
      let t = capitalize(s.trim());
      if (!t) return t;
      // Русское «я» всегда с большой буквы
      t = t.replace(/(?<![\p{L}])я(?![\p{L}])/gu, 'Я');
      if (!/[.!?…,:]$/.test(t)) t += '.';
      return t;
    })
    .filter(Boolean);
}

/** Абзацы → массивы предложений. Переносы от «новая строка»/«абзац» сохраняются. */
function textToBlocks(text, pack) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((p) => sentenceize(p, pack)).filter((b) => b.length);
}

/** Шаг 6: режимы стилизации */
function applyMode(blocks, mode, lang, opts = {}) {
  const pack = lang === 'en' ? EN : RU;
  const signatureName = (opts.name || '').trim() || (lang === 'en' ? 'Team 1mesto' : 'Команда 1mesto');
  const flat = blocks.flat();
  const joinParas = (sep) => blocks.map((s) => s.join(' ')).join(sep);

  switch (mode) {
    case 'email': {
      const body = joinParas('\n\n');
      const hasGreeting =
        lang === 'en'
          ? /^(hi|hello|hey|dear)\b/i.test(body)
          : /^(привет|здравствуйте|добрый день|добрый вечер|доброе утро)/i.test(body);
      const greeting = hasGreeting ? '' : `${pack.emailGreeting}\n\n`;
      return `${greeting}${body}\n\n${pack.emailSignature},\n${signatureName}`;
    }
    case 'bullets': {
      return flat.map((s) => `•  ${s.replace(/[.]$/, '')}`).join('\n');
    }
    case 'chat': {
      const emojiPool = ['🙂', '👍', '🚀', '✨', '🔥'];
      const idx = flat.join(' ').length % emojiPool.length;
      // Предложения уже с терминальной пунктуацией — просто склеиваем
      return `${flat.join(' ')} ${emojiPool[idx]}`;
    }
    case 'code': {
      const markTerms = (s) => {
        for (const term of TECH_TERMS) {
          s = s.replace(new RegExp(`${L}${esc(term)}${R}`, 'giu'), (m) => `\`${m}\``);
        }
        return s;
      };
      const title = lang === 'en' ? '**Tech note**' : '**Техническая заметка**';
      const bullets = flat.map((s) => `•  ${markTerms(s)}`).join('\n');
      return `${title}\n\n${bullets}`;
    }
    default:
      return joinParas('\n\n');
  }
}

/**
 * Главная функция. Возвращает { text, meta }.
 * Опции: mode, lang, name, dict (H), macros (AJ), autoPunct (G-16),
 * normalizeNumbers (F-10), autoLists (G-10/11).
 */
export function formatText(raw, opts = {}) {
  const {
    mode = 'clean',
    lang = 'ru',
    name = '',
    dict = null,
    macros = null,
    autoPunct = true,
    normalizeNumbers: normNums = true,
    autoLists = true,
    voiceCommands = true,
    restoreYo = false,
  } = opts;

  // O-14: мусорный тип на входе (число/объект/null) не роняет форматтер
  if (typeof raw !== 'string') {
    raw = raw == null || Number.isNaN(raw) ? '' : String(raw);
  }
  if (!raw || !raw.trim()) {
    return { text: '', meta: { removedFillers: 0, sentences: 0, mode, words: 0, dictHits: [] } };
  }
  const pack = lang === 'en' ? EN : RU;

  let text = raw.replace(/\s+/g, ' ').trim();
  text = normalizeHomoglyphs(text); // I-10: чиним смесь алфавитов до словаря
  let yoFixed = 0;
  text = applySelfCorrection(text); // F-21
  text = collapseRepeats(text); // F-19
  text = removeFillers(text, pack).text; // F-20
  if (lang !== 'en' && normNums) {
    text = normalizeDates(text); // F-11: «пятое марта» → «5 марта» (до чисел: «двадцать пятое» не разбивать)
    text = normalizeDotGroups(text); // ASR: «5.000» → «5000»
    text = normalizeTimeOfDay(text); // F-12: «три часа дня» → «15:00» (до чисел)
    text = normalizeNumbers(text); // F-10
  }
  text = normalizeDomainsEmailsPhones(text); // F-15..F-18
  if (autoLists && lang !== 'en') {
    text = applyListCommands(text); // G-10/G-11
  }
  if (voiceCommands) {
    text = applySpokenPunctuation(text, pack); // K: голосовые команды пунктуации/разметки
  }
  const dictRes = applyDictionary(text, dict, macros); // H + AJ
  text = dictRes.text;
  if (lang !== 'en' && restoreYo) {
    const yo = restoreYoLetters(text); // Ё: е→ё там, где она всегда
    text = yo.text;
    yoFixed = yo.fixed;
  }
  text = normalizeQuantities(text); // F-12..F-14, G-18
  text = tidyPunctuation(text);
  if (autoPunct) {
    text = insertCommas(text, pack);
    text = tidyPunctuation(text);
  }
  text = text.replace(/(^|[.!?]\s+)[,.;:]\s*/g, '$1'); // висячие знаки в начале предложений

  let blocks;
  if (autoPunct) {
    blocks = textToBlocks(text, pack);
  } else {
    // без автопунктуации: сохраняем как диктовали, только чистим пробелы
    blocks = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => [p]);
  }
  const finalText = applyMode(blocks, mode, lang, { name });

  return {
    text: finalText,
    meta: {
      removedFillers: removedFillersCount(raw, pack),
      sentences: blocks.flat().length,
      mode,
      words: countWords(finalText),
      dictHits: dictRes.hits,
      yoFixed,
    },
  };
}

/** сколько паразитов было в исходнике (для бейджа) */
function removedFillersCount(raw, pack) {
  let removed = 0;
  for (const f of pack.fillers) {
    const re = new RegExp(`${L}${esc(f)}${R}`, 'giu');
    const m = raw.match(re);
    if (m) removed += m.length;
  }
  return removed;
}

export function countWordsIn(text) {
  return countWords(text);
}

/** Примеры «сырой диктовки» для демо-режима (без микрофона) */
export const DEMO_SAMPLES = {
  ru: 'эм ну привет это самое я хотел сказать что типа наш проект по голосовому вводу готов и работает точка мы сделали мгновенное распознавание речи запятая умную очистку от слов паразитов и ещё аналитику скорости ввода точка в общем короче завтра мы показываем демо жюри и я думаю что оно им очень понравится восклицательный знак кстати команда уже подготовила красивую презентацию точка',
  en: 'um hey so basically I wanted to say that our voice dictation project is done and it works period we built instant speech recognition comma smart filler cleanup and also speed analytics period so anyway tomorrow we demo it to the jury and I think they will really like it exclamation mark by the way the team already prepared a beautiful presentation period',
};
