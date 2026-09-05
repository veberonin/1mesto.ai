// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, countWordsIn, DEMO_SAMPLES } from '../src/lib/formatter.js';

// ---------------------------------------------------------------------------
// countWordsIn
// ---------------------------------------------------------------------------
test('countWordsIn считает слова', () => {
  assert.equal(countWordsIn('привет мир пока'), 3);
  assert.equal(countWordsIn(''), 0);
  assert.equal(countWordsIn('   '), 0);
  assert.equal(countWordsIn('one two  three   four'), 4);
});

// ---------------------------------------------------------------------------
// Удаление слов-паразитов (RU)
// ---------------------------------------------------------------------------
test('убирает русские слова-паразиты', () => {
  const { text, meta } = formatText('эм ну привет как дела', { lang: 'ru' });
  assert.ok(!text.includes('эм'), 'нет «эм»');
  assert.ok(!/\bну\b/i.test(text.replace(/[а-яё]+/gi, (m) => m)), 'нет «ну»');
  assert.ok(text.includes('Привет'));
  assert.ok(meta.removedFillers >= 2);
});

test('не ломает слова, содержащие паразитов внутри', () => {
  // «ну» внутри «кнопку» не должно удалиться
  const { text } = formatText('нажми кнопку дома', { lang: 'ru' });
  assert.ok(text.includes('кнопку'));
});

// ---------------------------------------------------------------------------
// Голосовая пунктуация
// ---------------------------------------------------------------------------
test('превращает «точка» в точку и разбивает на предложения', () => {
  const { text } = formatText('привет точка как дела вопросительный знак', { lang: 'ru' });
  assert.equal(text, 'Привет. Как дела?');
});

test('превращает «запятая» в запятую', () => {
  const { text } = formatText('купи хлеб запятая молоко и сыр', { lang: 'ru' });
  assert.ok(text.includes('хлеб, молоко'));
});

test('«новая строка» и «абзац» делают перенос', () => {
  const { text } = formatText('первая часть новая строка вторая часть', { lang: 'ru' });
  assert.ok(text.includes('\n'));
  const { text: t2 } = formatText('первый абзац абзац второй абзац', { lang: 'ru' });
  assert.ok(t2.includes('\n\n'));
});

test('чистит пробелы перед знаками препинания', () => {
  const { text } = formatText('привет , мир', { lang: 'ru' });
  assert.ok(text.includes('Привет, мир.'));
  assert.ok(!text.includes(' ,'));
});

// ---------------------------------------------------------------------------
// Грамматические запятые и регистр
// ---------------------------------------------------------------------------
test('ставит запятую перед «но», «потому что», «который»', () => {
  const t1 = formatText('я хотел пойти но дождь начался', { lang: 'ru' }).text;
  assert.ok(t1.includes('пойти, но'));
  const t2 = formatText('я остался дома потому что устал', { lang: 'ru' }).text;
  assert.ok(t2.includes('дома, потому что'));
  const t3 = formatText('дом который стоит у реки', { lang: 'ru' }).text;
  assert.ok(/дом, который/i.test(t3));
});

test('русское «я» всегда с большой буквы', () => {
  const { text } = formatText('я думаю что я молодец', { lang: 'ru' });
  assert.ok(text.includes('Я думаю'));
  assert.ok(text.includes('Я молодец'));
  assert.ok(!/(?<![А-ЯЁа-яё])я(?![А-ЯЁа-яё])/.test(text.replace(/Я/g, '')), 'нет строчных «я»');
});

test('каждое предложение начинается с заглавной', () => {
  const { text } = formatText('первое предложение точка второе предложение', { lang: 'ru' });
  assert.equal(text, 'Первое предложение. Второе предложение.');
});

// ---------------------------------------------------------------------------
// Режимы стилизации
// ---------------------------------------------------------------------------
test('email: приветствие и подпись с именем', () => {
  const { text } = formatText('это тестовое письмо', { mode: 'email', lang: 'ru', name: 'Веберонин' });
  assert.ok(text.startsWith('Добрый день!'));
  assert.ok(text.includes('С уважением,\nВеберонин'));
});

test('email: не дублирует приветствие, если оно уже есть', () => {
  const { text } = formatText('здравствуйте как дела', { mode: 'email', lang: 'ru', name: 'X' });
  assert.ok(!text.startsWith('Добрый день!'));
  assert.ok(text.startsWith('Здравствуйте'));
});

test('bullets: каждое предложение — пункт списка', () => {
  const { text } = formatText('первый пункт точка второй пункт точка', { mode: 'bullets', lang: 'ru' });
  const lines = text.split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => l.startsWith('•')));
});

test('chat: заканчивается эмодзи', () => {
  const { text } = formatText('привет как дела', { mode: 'chat', lang: 'ru' });
  assert.match(text, /[\p{Emoji_Presentation}\u{FE0F}]$/u);
  assert.ok(!text.endsWith('..'));
});

test('code: оборачивает техтермины в бэктики', () => {
  const { text } = formatText('нам нужен react и docker точка потом vite', {
    mode: 'code',
    lang: 'ru',
  });
  assert.ok(text.includes('`react`'));
  assert.ok(text.includes('`docker`'));
  assert.ok(text.includes('`vite`'));
  assert.ok(text.includes('**Техническая заметка**'));
});

// ---------------------------------------------------------------------------
// Английский
// ---------------------------------------------------------------------------
test('EN: паразиты и голосовая пунктуация', () => {
  const { text } = formatText('um hello world period how are you question mark', { lang: 'en' });
  assert.equal(text, 'Hello world. How are you?');
});

test('EN: email на английском', () => {
  const { text } = formatText('just testing', { mode: 'email', lang: 'en', name: 'Team 1mesto' });
  assert.ok(text.startsWith('Hi there!'));
  assert.ok(text.includes('Best regards,\nTeam 1mesto'));
});

// ---------------------------------------------------------------------------
// Демо-примеры и пустые входы
// ---------------------------------------------------------------------------
test('пустой ввод даёт пустой результат', () => {
  const { text, meta } = formatText('   ', { lang: 'ru' });
  assert.equal(text, '');
  assert.equal(meta.words, 0);
});

test('демо-примеры RU и EN корректно форматируются', () => {
  const ru = formatText(DEMO_SAMPLES.ru, { lang: 'ru' });
  assert.ok(ru.meta.removedFillers >= 3, 'в демо есть паразиты');
  assert.ok(ru.text.includes('!'), 'есть восклицательный знак');
  assert.ok(!ru.text.includes('эм'), 'паразиты убраны');

  const en = formatText(DEMO_SAMPLES.en, { lang: 'en' });
  assert.ok(en.text.includes('!'), 'exclamation mark отработал');
  assert.ok(!/\bum\b/i.test(en.text), 'um убран');
});

test('в result meta есть счётчики', () => {
  const { meta } = formatText('привет мир точка пока', { mode: 'clean', lang: 'ru' });
  assert.equal(meta.mode, 'clean');
  assert.equal(meta.sentences, 2);
  assert.ok(meta.words > 0);
});
