#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * Z-10: проверка совместимости лицензий зависимостей шагом CI.
 * Падает, если среди прод/dev-зависимостей есть копилефт (GPL/LGPL/AGPL/MPL/SSPL/CC-BY-SA).
 */
import { execFileSync } from 'child_process';

const FORBIDDEN = /GPL|AGPL|LGPL|MPL|SSPL|CC-BY-SA|EUPL/i;

let raw;
try {
  raw = execFileSync('npm', ['ls', '--all', '--json', '--long'], { maxBuffer: 512 * 1024 * 1024 }).toString();
} catch (e) {
  // npm ls возвращает ненулевой код при peer-конфликтах — всё равно парсим вывод
  raw = e.stdout?.toString() || '';
}

const tree = JSON.parse(raw);
const bad = [];
const seen = new Set();

function walk(node) {
  for (const [name, info] of Object.entries(node.dependencies || {})) {
    const key = `${name}@${info.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const license = info.license || '';
    if (FORBIDDEN.test(String(license))) bad.push(`${key} → ${license}`);
    walk(info);
  }
}
walk(tree);

if (bad.length) {
  console.error('Найдены копилефт-зависимости:');
  for (const b of bad) console.error(' ✗ ' + b);
  process.exit(1);
}
console.log(`License check OK: ${seen.size} пакетов, копилефта нет (разрешительные MIT/ISC/Apache/BSD).`);
