// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, normalizeHomoglyphs, stripModelTags } from '../src/lib/formatter.js';

function bigDict(n) {
  const dict = {};
  for (let i = 0; i < n; i++) dict[`термин${i}`] = `Т${i}`;
  return dict;
}

describe('H-07/H-08: словарь не деградирует по задержке (один проход)', () => {
  it('120 позиций — реплика быстрее 50 мс (тёплый кеш)', () => {
    const dict = bigDict(120);
    formatText('раз термин1 два', { dict }); // прогрев
    const t0 = process.hrtime.bigint();
    formatText('упомянул термин42 точка', { dict });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 50, `120 позиций заняли ${ms.toFixed(1)} мс`);
  });

  it('5000 позиций — реплика быстрее 300 мс (тёплый кеш), без цикла по словарю', () => {
    const dict = bigDict(5000);
    formatText('раз термин1 два', { dict }); // прогрев
    const t0 = process.hrtime.bigint();
    const r = formatText('упомянул термин42 и термин4999 точка', { dict });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 300, `5000 позиций заняли ${ms.toFixed(1)} мс`);
    assert.deepEqual(r.meta.dictHits, ['термин42', 'термин4999']);
    assert.match(r.text, /Т42/);
    assert.match(r.text, /Т4999/);
  });

  it('приоритет: пользовательский словарь побеждает встроенные термины', () => {
    const r = formatText('скажи реакт', { dict: { реакт: 'React 19' } });
    assert.match(r.text, /React 19/);
  });

  it('H-14: пустой/битый словарь не ломает обработку', () => {
    assert.match(formatText('привет мир', { dict: {} }).text, /Привет мир/);
    assert.match(formatText('привет мир', { dict: null }).text, /Привет мир/);
    assert.match(formatText('привет мир', {}).text, /Привет мир/);
  });

  it('H-11: регистр замены сохраняется как в словаре, регистр совпадения учитывается', () => {
    const r = formatText('начал с пмо и закончил', { dict: { пмо: 'ПМО-управление' } });
    assert.match(r.text, /Пмо-управление|ПМО-управление/);
    const r2 = formatText('упомянул ПМО дважды', { dict: { пмо: 'ПМО' } });
    assert.match(r2.text, /ПМО/);
  });

  it('H-06: синонимы сводятся к одной форме', () => {
    const r = formatText('один эс эс эс и второй эс эс эс', {});
    assert.ok(!r.text.includes('эс эс эс'));
  });
});

describe('F-28/I-05: Казань и Татарстан из коробки', () => {
  it('топонимы с заглавной', () => {
    const r = formatText('я живу в казани на баумана, татарстан', {});
    assert.match(r.text, /Казани/);
    assert.match(r.text, /Баумана/);
    assert.match(r.text, /Татарстан/);
  });

  it('имя Габдулла Тукай целиком', () => {
    const r = formatText('читал габдулла тукай вчера', {});
    assert.match(r.text, /Габдулла Тукай/);
  });
});

describe('I-10: гомоглифы — смесь алфавитов чинится', () => {
  it('латинские двойники внутри кириллического слова заменяются', () => {
    assert.equal(normalizeHomoglyphs('рeакт'), 'реакт');
    assert.equal(normalizeHomoglyphs('теgст c сервером'), 'тегст с сервером');
  });
  it('чистая латиница не трогается', () => {
    assert.equal(normalizeHomoglyphs('react repo'), 'react repo');
  });
});

describe('AM-19: служебные теги моделей не попадают в текст', () => {
  it('fence, <think>, префикс «Ответ:», спец-токены срезаются', () => {
    assert.equal(stripModelTags('<think>рассуждаю</think>Готово'), 'Готово');
    assert.equal(stripModelTags('```\nJSON готов\n```'), 'JSON готов');
    assert.equal(stripModelTags('Ответ: всё ок'), 'всё ок');
    assert.equal(stripModelTags('<|im_start|>текст'), 'текст');
    assert.equal(stripModelTags(''), '');
  });
});
