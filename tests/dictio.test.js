// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePairsText, serializePairs, mergeIntoText, DICT_TEMPLATE } from '../src/lib/dictio.js';

describe('dictio: parsePairsText (H-01)', () => {
  it('парсит строки «слово = замена» во всех вариантах разделителя', () => {
    const { dict, macros, errors } = parsePairsText(
      '1с = 1С\nбитрикс24: Битрикс24\nпмо, ПМО\nжк;ЖК\tтаб\n'
    );
    assert.deepEqual(dict, { '1с': '1С', битрикс24: 'Битрикс24', пмо: 'ПМО', жк: 'ЖК\tтаб' });
    assert.deepEqual(macros, {});
    assert.equal(errors.length, 0);
  });

  it('#ключ → макросы, комментарии #/ / пропускаются, мусор — в errors', () => {
    const { dict, macros, errors } = parsePairsText(
      '#адрес = Тверская 1\n# комментарий\n// комментарий\nсломанная-строка-без-разделителя\n= пустой ключ\nслово = \nок = работает'
    );
    assert.deepEqual(macros, { адрес: 'Тверская 1' });
    assert.deepEqual(dict, { ок: 'работает' });
    assert.equal(errors.length, 3);
  });

  it('JSON-объект {слово: замена}', () => {
    const { dict, errors } = parsePairsText('{"1тесто": "1С", "зепись": "запись"}');
    assert.deepEqual(dict, { '1тесто': '1С', зепись: 'запись' });
    assert.equal(errors.length, 0);
  });

  it('JSON-массив [{from,to}] и [ключ, значение]', () => {
    const { dict } = parsePairsText('[{"from":"пмо","to":"ПМО"},["жк","ЖК"]]');
    assert.deepEqual(dict, { пмо: 'ПМО', жк: 'ЖК' });
  });

  it('JSON {dict:{}, macros:{}} разделяет секции (макросы без решётки)', () => {
    const { dict, macros } = parsePairsText('{"dict":{"1с":"1С"},"macros":{"#адрес":"Тверская","подпись":"С уважением"}}');
    assert.deepEqual(dict, { '1с': '1С' });
    assert.deepEqual(macros, { адрес: 'Тверская', подпись: 'С уважением' });
  });

  it('пустой ввод → пустой результат', () => {
    const { dict, macros, errors } = parsePairsText('   \n  ');
    assert.deepEqual({ dict, macros, errors }, { dict: {}, macros: {}, errors: [] });
  });
});

describe('dictio: serialize/merge', () => {
  it('serializePairs выводит макросы с решёткой и обратно парсится (roundtrip)', () => {
    const text = serializePairs({ '1с': '1С' }, { адрес: 'Тверская 1' });
    const { dict, macros } = parsePairsText(text);
    assert.deepEqual(dict, { '1с': '1С' });
    assert.deepEqual(macros, { адрес: 'Тверская 1' });
  });

  it('mergeIntoText: новые значения побеждают, остальное сохраняется', () => {
    const cur = '1с = 1С\nпмо = ПМО';
    const next = mergeIntoText(cur, parsePairsText('1с = ОдинЭс\nжк = ЖК'));
    const { dict } = parsePairsText(next);
    assert.deepEqual(dict, { '1с': 'ОдинЭс', пмо: 'ПМО', жк: 'ЖК' });
  });

  it('шаблон непустой и сам парсится без ошибок', () => {
    const { dict, macros, errors } = parsePairsText(DICT_TEMPLATE);
    assert.ok(Object.keys(dict).length >= 3);
    assert.ok(Object.keys(macros).length >= 2);
    assert.equal(errors.length, 0);
  });
});
