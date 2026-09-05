// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Словарь замен и макросы: парсинг из текста/файла (H-01), сериализация, шаблон.
 * Форматы строк: «слово = замена», «слово: замена», «слово, замена», «слово;замена», TSV.
 * Строки, начинающиеся с «#» + пробел или «//» — комментарии.
 * Макросы: ключ с «#» («#адрес = Тверская 1») — фраза-разворот.
 * JSON: {"слово":"замена"} | [{"from":"x","to":"y"}] | [["x","y"]] | {"dict":{...},"macros":{...}}.
 */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Разбирает одну пару «ключ → значение»; ключ с «#» уходит в макросы */
function makePutter(dict, macros) {
  return function put(from, to) {
    const key = String(from ?? '').trim();
    const val = String(to ?? '').trim();
    if (!key || !val) return false;
    if (key.startsWith('#')) {
      const mk = key.slice(1).trim() || key;
      macros[mk] = val;
    } else {
      dict[key] = val;
    }
    return true;
  };
}

function absorbJson(data, put) {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (Array.isArray(item) && item.length >= 2) {
        put(item[0], item[1]);
      } else if (isPlainObject(item) && item.from != null) {
        put(item.from, item.to ?? item.replace ?? '');
      }
    }
  } else if (isPlainObject(data)) {
    if (isPlainObject(data.dict) || isPlainObject(data.macros)) {
      for (const [k, v] of Object.entries(data.dict || {})) if (typeof v === 'string') put(k, v);
      // в секции macros всё принудительно становится макросом (решётка нормализуется)
      for (const [k, v] of Object.entries(data.macros || {})) if (typeof v === 'string') put(`#${String(k).replace(/^#/, '')}`, v);
    } else {
      for (const [k, v] of Object.entries(data)) if (typeof v === 'string') put(k, v);
    }
  }
}

/**
 * Парсит текст (из textarea или файла) → { dict, macros, errors }.
 * errors — неразобранные непустые строки (показываем пользователю счётчик).
 */
export function parsePairsText(input) {
  const dict = {};
  const macros = {};
  const errors = [];
  if (!input || !String(input).trim()) return { dict, macros, errors };

  const text = String(input).trim();
  const put = makePutter(dict, macros);

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      absorbJson(JSON.parse(text), put);
      return { dict, macros, errors };
    } catch {
      /* не JSON — парсим построчно */
    }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('# ')) continue;
    const m = line.match(/[=:,;\t]/);
    if (!m || m.index === 0) {
      errors.push(line);
      continue;
    }
    const from = line.slice(0, m.index).trim();
    const to = line.slice(m.index + 1).trim();
    if (!from || !to) {
      errors.push(line);
      continue;
    }
    put(from, to);
  }
  return { dict, macros, errors };
}

/** Объекты → текст для textarea (макросы с «#») */
export function serializePairs(dict = {}, macros = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(macros)) lines.push(`#${k} = ${v}`);
  for (const [k, v] of Object.entries(dict)) lines.push(`${k} = ${v}`);
  return lines.join('\n');
}

/**
 * Импорт из файла: мержим распарсенное к текущему тексту textarea.
 * Новые значения перезаписывают существующие ключи, остальное сохраняется.
 */
export function mergeIntoText(currentText, parsed) {
  const cur = parsePairsText(currentText);
  const dict = { ...cur.dict, ...(parsed.dict || {}) };
  const macros = { ...cur.macros, ...(parsed.macros || {}) };
  return serializePairs(dict, macros);
}

/** Готовый шаблон для пользователей (кнопка «Скачать шаблон») */
export const DICT_TEMPLATE = `# 1mesto Flow — словарь замен и макросы
# Формат: слово = замена   (или «слово: замена», «слово, замена», TSV)
# Строка с «#» в начале ключа — макрос (фраза-разворот). «//» — комментарий.
# Можно также импортировать JSON: {"1тесто":"1С"} или [{"from":"пмо","to":"ПМО"}]

// —— Словарь: как слышится → как надо писать
1с = 1С
битрикс24 = Битрикс24
пмо = ПМО
жк = ЖК
ип = ИП

// —— Макросы: разворачиваются по имени с решёткой
#адрес = г. Москва, ул. Тверская, д. 1, офис 100
#подпись = С уважением, команда 1mesto Flow
`;
