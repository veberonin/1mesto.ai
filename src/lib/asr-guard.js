// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Guard транскрипта (F-22/F-23): распознаватели на тишине/музыке иногда
 * «галлюцинируют» известные фразы. Здесь сырой текст от whisper/Gemini
 * чистится:_known галлюцинации вырезаются, бессмысленный результат → пусто.
 */

const HALLUCINATIONS = [
  // Титры фильмов/перевода: Google Web Speech в русском обучен на субтитровых
  // дорожках и вставляет их на тишине или фоновом ТВ («Редактор субтитров
  // Н.Иванов …», «Корректор А.Петрова»)
  /редактор(ы)?\s+субтитров\s+[^,.]{0,60}/i,
  // Имя с заглавной после профессии — признак титров; без /i, чтобы не резать речь
  // («корректор сдаёт отчёт» — это реплика, «Корректор В.Иванов» — титры)
  /(?:[Кк]орректор|[Пп]ереводчик|[Зз]вукорежисс[её]р|[Зз]вукооператор|[Мм]онтаж[её]р|[Аа]вторы?\s+(?:перевода|субтитров)|[Рр]олик\s+озвучки|[Оо]звучка)\s+[А-ЯЁA-Z][^,.]{0,60}/,
  /(технический\s+)?перерыв|окончание\s+(сеанса|фильма|эфира)/i,
  /субтитры\s+делал(а)?\s+\S+/i,
  /продолжение\s+следует/i,
  /спасибо\s+за\s+просмотр/i,
  /подпишитесь\s+на\s+канал/i,
  /до\s+новых\s+встреч/i,
  /смотрите\s+также/i,
  /\[?музыка\]?/i,
  /амбивалентные\s+тоны/i,
  /thanks\s+for\s+watching/i,
  /subscribe\s+to\s+the\s+channel/i,
  /stay\s+tuned/i,
];

/**
 * Чистит транскрипт: срезает известные галлюцинации, служебные теги и
 * лишние пробелы. Возвращает { text, hallucinated } — hallucinated=true,
 * если после чистки не осталось осмысленного текста.
 */
export function sanitizeTranscript(raw) {
  let text = String(raw || '').trim();
  if (!text) return { text: '', hallucinated: true };
  let hallucinated = false;
  for (const re of HALLUCINATIONS) {
    if (re.test(text)) {
      text = text.replace(re, ' ');
      hallucinated = true;
    }
  }
  text = text.replace(/\s+/g, ' ').trim();
  // слишком короткий «мусор» после чистки (одна буква/пунктуация) — не реплика
  if (text.replace(/[^\p{L}\p{N}]/gu, '').length < 2) {
    return { text: '', hallucinated: true };
  }
  return { text, hallucinated };
}

/** Известные модели-галлюцинаторы целиком совпадают с фразой — реплики нет */
export function isPureHallucination(raw) {
  const { text, hallucinated } = sanitizeTranscript(raw);
  return hallucinated && !text;
}
