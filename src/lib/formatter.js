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
    'эм', 'ээм', 'эээ', 'э-э', 'мм', 'ммм', 'м-м',
    'ну', 'вот', 'типа', 'как бы', 'это самое', 'как его',
    'короче', 'в общем', 'скажем так', 'как сказать',
    'ага', 'угу', 'ну вот',
  ],
  spokenPunct: [
    ['точка с запятой', ';'],
    ['вопросительный знак', '?'],
    ['восклицательный знак', '!'],
    ['с нового абзаца', '\n\n'],
    ['новый абзац', '\n\n'],
    ['абзац', '\n\n'],
    ['с новой строки', '\n'],
    ['новая строка', '\n'],
    ['перенос строки', '\n'],
    ['двоеточие', ':'],
    ['точка', '.'],
    ['запятая', ','],
  ],
  commaBefore: ['но', 'зато', 'однако', 'потому что', 'так как', 'который', 'которая', 'которое', 'которые', 'чтобы', 'хотя', 'ведь', 'что', 'а', 'когда'],
  breakWords: ['потом', 'дальше', 'также', 'кстати', 'в итоге', 'кроме того', 'плюс ко всему'],
  emailGreeting: 'Добрый день!',
  emailSignature: 'С уважением',
};

const EN = {
  fillers: [
    'um', 'uhm', 'uh', 'erm', 'hmm',
    'you know', "i mean", 'sort of', 'kind of', 'basically',
  ],
  spokenPunct: [
    ['question mark', '?'],
    ['exclamation mark', '!'],
    ['exclamation point', '!'],
    ['new paragraph', '\n\n'],
    ['new line', '\n'],
    ['semicolon', ';'],
    ['colon', ':'],
    ['full stop', '.'],
    ['period', '.'],
    ['comma', ','],
  ],
  commaBefore: ['but', 'however', 'because', 'which', 'although', 'so that'],
  breakWords: ['then', 'also', 'by the way', 'after that', 'anyway'],
  emailGreeting: 'Hi there!',
  emailSignature: 'Best regards',
};

const TECH_TERMS = [
  'react', 'vue', 'angular', 'node', 'express', 'python', 'javascript', 'typescript',
  'postgres', 'postgresql', 'mongodb', 'redis', 'tailwind', 'webpack', 'docker',
  'kubernetes', 'github', 'websocket', 'openai', 'gemini', 'typescript', 'vite',
  'vercel', 'kafka', 'graphql', 'rust', 'golang',
];

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).filter(Boolean).length : 0);

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Границы слова, работающие и с кириллицей, и с латиницей */
const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Шаг 1: голосовые команды пунктуации → символы */
function applySpokenPunctuation(text, pack) {
  let out = text;
  for (const [phrase, symbol] of pack.spokenPunct) {
    out = out.replace(new RegExp(`${L}${esc(phrase)}${R}`, 'giu'), ` ${symbol} `);
  }
  return out;
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

/** Шаг 3: чистка пробелов вокруг пунктуации */
function tidyPunctuation(text) {
  return text
    .replace(/[ \t]+([,.!?;:…])/g, '$1')
    .replace(/([,.!?;:])(?=[^\s\d.,!?;:)])/g, '$1 ')
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
  for (const w of pack.commaBefore) {
    const re = new RegExp(`(?<=[\\p{L}\\d])\\s+(${esc(w)})(?=\\s)`, 'giu');
    out = out.replace(re, ', $1');
  }
  return out;
}

/** Шаг 5: разбиваем «поток сознания» на предложения */
function sentenceize(text, pack) {
  let parts = text
    .split(/(?<=[.!?…])\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  for (const part of parts) {
    const words = part.split(/\s+/);
    let buffer = [];
    for (let i = 0; i < words.length; i++) {
      buffer.push(words[i]);
      const rest = words.slice(i + 1, i + 4).join(' ').toLowerCase();
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

/** Шаг 6: режимы стилизации */
function applyMode(sentences, mode, lang, opts = {}) {
  const pack = lang === 'en' ? EN : RU;
  const signatureName = (opts.name || '').trim() || (lang === 'en' ? 'Team 1mesto' : 'Команда 1mesto');

  switch (mode) {
    case 'email': {
      const body = sentences.join(' ');
      const hasGreeting = lang === 'en'
        ? /^(hi|hello|hey|dear)\b/i.test(body)
        : /^(привет|здравствуйте|добрый день|добрый вечер|доброе утро)/i.test(body);
      const greeting = hasGreeting ? '' : `${pack.emailGreeting}\n\n`;
      return `${greeting}${body}\n\n${pack.emailSignature},\n${signatureName}`;
    }
    case 'bullets': {
      return sentences.map((s) => `•  ${s.replace(/[.]$/, '')}`).join('\n');
    }
    case 'chat': {
      const emojiPool = ['🙂', '👍', '🚀', '✨', '🔥'];
      const idx = sentences.join(' ').length % emojiPool.length;
      // Предложения уже с терминальной пунктуацией — просто склеиваем
      return `${sentences.join(' ')} ${emojiPool[idx]}`;
    }
    case 'code': {
      const markTerms = (s) => {
        for (const term of TECH_TERMS) {
          s = s.replace(new RegExp(`${L}${esc(term)}${R}`, 'giu'), (m) => `\`${m}\``);
        }
        return s;
      };
      const title = lang === 'en' ? '**Tech note**' : '**Техническая заметка**';
      const bullets = sentences.map((s) => `•  ${markTerms(s)}`).join('\n');
      return `${title}\n\n${bullets}`;
    }
    default:
      return sentences.join(' ');
  }
}

/**
 * Главная функция. Возвращает { text, meta }.
 */
export function formatText(raw, { mode = 'clean', lang = 'ru', name = '' } = {}) {
  if (!raw || !raw.trim()) return { text: '', meta: { removedFillers: 0, sentences: 0, mode, words: 0 } };
  const pack = lang === 'en' ? EN : RU;

  let text = raw.replace(/\s+/g, ' ').trim();
  text = applySpokenPunctuation(text, pack);

  const { text: noFillers, removed } = removeFillers(text, pack);
  text = tidyPunctuation(noFillers);
  text = insertCommas(text, pack);
  text = tidyPunctuation(text);
  text = text.replace(/(^|[.!?]\s+)[,.;:]\s*/g, '$1'); // висячие знаки в начале предложений

  const sentences = sentenceize(text, pack);
  const finalText = applyMode(sentences, mode, lang, { name });

  return {
    text: finalText,
    meta: {
      removedFillers: removed,
      sentences: sentences.length,
      mode,
      words: countWords(finalText),
    },
  };
}

export function countWordsIn(text) {
  return countWords(text);
}

/** Примеры «сырой диктовки» для демо-режима (без микрофона) */
export const DEMO_SAMPLES = {
  ru: 'эм ну привет это самое я хотел сказать что типа наш проект по голосовому вводу готов и работает точка мы сделали мгновенное распознавание речи запятая умную очистку от слов паразитов и ещё аналитику скорости ввода точка в общем короче завтра мы показываем демо жюри и я думаю что оно им очень понравится восклицательный знак кстати команда уже подготовила красивую презентацию точка',
  en: 'um hey so basically I wanted to say that our voice dictation project is done and it works period we built instant speech recognition comma smart filler cleanup and also speed analytics period so anyway tomorrow we demo it to the jury and I think they will really like it exclamation mark by the way the team already prepared a beautiful presentation period',
};
