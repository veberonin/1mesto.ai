// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, parseRuNumber, replaceInText, DEMO_SAMPLES } from '../src/lib/formatter.js';

// ---------------------------------------------------------------------------
// Числа, деньги, время, контакты (F-10..F-18, G-18)
// ---------------------------------------------------------------------------
test('F-10: слова-числа → цифры', () => {
  assert.equal(formatText('заплати пять тысяч рублей', {}).text, 'Заплати 5000 ₽.');
  assert.equal(formatText('двадцать пять лет', {}).text, '25 лет.');
  assert.equal(formatText('две тысячи пятьсот рублей', {}).text, '2500 ₽.');
});

test('F-10: одиночные «один/одна» не превращаются в 1', () => {
  assert.ok(formatText('один момент', {}).text.startsWith('Один момент'));
});

test('parseRuNumber: составные числа', () => {
  assert.deepEqual(parseRuNumber(['сто', 'двадцать', 'три'], 0), [123, 3]);
  assert.deepEqual(parseRuNumber(['две', 'тысячи', 'пятьсот'], 0), [2500, 3]);
  assert.equal(parseRuNumber(['привет'], 0), null);
});

test('F-12: время → ЧЧ:ММ', () => {
  assert.ok(formatText('встреча в пять часов тридцать минут', {}).text.includes('05:30'));
});

test('F-13/F-14: деньги и проценты', () => {
  assert.ok(formatText('скидка пятьдесят процентов', {}).text.includes('50%'));
  assert.ok(formatText('цена десять долларов', {}).text.includes('10 $'));
});

test('F-16/F-17: email и домен собираются в один токен', () => {
  assert.ok(formatText('пиши на бро собака почта точка ру', {}).text.includes('бро@почта.ру'));
  assert.ok(formatText('открой myapp точка com', {}).text.includes('myapp.com'));
});

test('F-15: телефон из цифр склеивается', () => {
  assert.ok(formatText('звони 8 9 1 7 1 2 3 4 5 6 7', {}).text.includes('89171234567'));
});

test('F-18: латинские одиночные буквы → аббревиатура, кириллица не трогается', () => {
  assert.ok(formatText('подключи а пи ай', {}).text.includes('API'));
  assert.ok(formatText('пишем на джаваскрипт', {}).text.includes('JavaScript'));
  assert.ok(!formatText('я в кино', {}).text.includes('ЯВ'));
});

test('F-19/F-21: повторы и самоисправление', () => {
  assert.ok(!formatText('это это хорошо', {}).text.includes('это это'));
  assert.equal(formatText('мы сделали фичу то есть переписали модуль', {}).text, 'Переписали модуль.');
});

test('G-18: неразрывный пробел в единицах', () => {
  assert.ok(formatText('вес пять кг', {}).text.includes('5\u00A0кг'));
});

// ---------------------------------------------------------------------------
// Списки и пунктуация по команде (G-05, G-08, G-10, G-11)
// ---------------------------------------------------------------------------
test('G-10/G-11: маркированный и нумерованный списки', () => {
  const bullets = formatText('маркированный список молоко далее хлеб', {}).text;
  assert.ok(bullets.includes('• молоко'));
  assert.ok(bullets.includes('• хлеб'));
  const numbered = formatText('нумерованный список первый шаг далее второй шаг', {}).text;
  assert.ok(numbered.includes('1. Первый шаг'));
  assert.ok(numbered.includes('2. Второй шаг'));
});

test('«далее» вне списка не превращается в буллет', () => {
  assert.ok(!formatText('и далее по тексту', {}).text.includes('•'));
});

test('G-05: тире и двоеточие по команде', () => {
  assert.ok(formatText('цена тире сто рублей', {}).text.includes('—'));
  assert.ok(formatText('внимание двоеточие проверка', {}).text.includes(':'));
});

test('G-16: автопунктуация отключается настройкой', () => {
  const r = formatText('как сказано так и осталось', { autoPunct: false });
  assert.ok(!r.text.startsWith('Как'), 'регистр не принудителен');
});

// ---------------------------------------------------------------------------
// Словарь терминов (H) и макросы (AJ)
// ---------------------------------------------------------------------------
test('H-02/H-11: термин подставляется, регистр как в диктовке', () => {
  const { text, meta } = formatText('обсудили реактив вчера', { dict: { реактив: 'React' } });
  assert.ok(text.includes('React'));
  assert.ok(meta.dictHits.includes('реактив'));
});

test('H-11: заглавная в диктовке сохраняется в термине', () => {
  const { text } = formatText('Реактив это библиотека', { dict: { реактив: 'React' } });
  assert.ok(text.includes('React это библиотека'));
});

test('H-14: пустой словарь не ломает обработку', () => {
  const { text } = formatText('обычный текст', { dict: {}, macros: {} });
  assert.ok(text.includes('Обычный'));
});

test('H-07/H-08: словарь на 5000 позиций без существенного роста задержки', () => {
  const big = {};
  for (let i = 0; i < 5000; i++) big[`термин${i}`] = `Термин${i}`;
  const t0 = process.hrtime.bigint();
  const { text } = formatText('упомянули термин4999', { dict: big });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(text.includes('Термин4999'));
  assert.ok(ms < 2000, `слишком долго: ${ms}мс`);
});

test('AJ-01/AJ-02: макрос разворачивает фразу в текст', () => {
  const { text } = formatText('отправь мой адрес', {
    macros: { 'мой адрес': 'г. Казань, ул. Баумана, 1' },
  });
  assert.ok(text.includes('г. Казань, ул. Баумана, 1'));
});

// ---------------------------------------------------------------------------
// Постобработка (J)
// ---------------------------------------------------------------------------
test('J-13: замени X на Y', () => {
  const out = replaceInText('замени говнокод на код', 'говнокод', 'чистый код');
  assert.ok(!out.includes('говнокод'));
});

test('J-09: правило вместо модели — детерминированный результат', () => {
  const a = formatText(DEMO_SAMPLES.ru, {});
  const b = formatText(DEMO_SAMPLES.ru, {});
  assert.equal(a.text, b.text);
});
