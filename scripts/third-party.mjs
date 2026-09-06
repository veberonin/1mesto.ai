#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
// Z-07/Z-09: перечень лицензий зависимостей + THIRD-PARTY-NOTICES одним файлом.
// Запуск: node scripts/third-party.mjs (пишет docs/THIRD-PARTY-NOTICES.md)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.join(root, 'node_modules');
const out = [
  '<!-- Сгенерировано scripts/third-party.mjs — не править руками -->',
  '# Third-party notices',
  '',
];

function scan(dir, depth = 0) {
  const found = [];
  if (depth > 3) return found;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('@')) found.push(...scan(p, depth + 1));
      else {
        const pj = path.join(p, 'package.json');
        try {
          const d = JSON.parse(fs.readFileSync(pj, 'utf8'));
          if (d.name) {
            found.push({
              name: d.name,
              version: d.version,
              license: d.license || 'UNKNOWN',
              homepage: d.homepage || '',
            });
          }
        } catch {}
        found.push(...scan(path.join(p, 'node_modules'), depth + 1));
      }
    }
  }
  return found;
}

const deps = scan(nm).sort((a, b) => a.name.localeCompare(b.name));
const byLicense = {};
for (const d of deps) (byLicense[d.license] = byLicense[d.license] || []).push(d);

out.push(`Зависимостей: ${deps.length}. Сводка лицензий:\n`);
for (const [lic, list] of Object.entries(byLicense).sort((a, b) => b[1].length - a[1].length)) {
  out.push(`- ${lic}: ${list.length}`);
}
out.push('\n## Полный перечень\n');
for (const d of deps) {
  out.push(`- **${d.name}@${d.version}** — ${d.license}${d.homepage ? ` · ${d.homepage}` : ''}`);
}
out.push('');
fs.writeFileSync(path.join(root, 'docs', 'THIRD-PARTY-NOTICES.md'), out.join('\n'));
console.log(
  `THIRD-PARTY-NOTICES.md: ${deps.length} зависимостей, лицензий: ${Object.keys(byLicense).length}`
);
