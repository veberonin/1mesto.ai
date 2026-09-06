// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
/**
 * M-17: шифрование журнала реплик по настройке.
 * AES-GCM-256 + PBKDF2-SHA256 (210 000 итераций, OWASP-ориентир 2026).
 * Ключ НИКОГДА не хранится: живёт в памяти сессии рендерера; в настройках
 * лежит только соль и проверочная строка (верификатор), зашифрованная этим же ключом.
 * Чистый WebCrypto — работает и в браузере, и в node (для тестов).
 */

const ITERATIONS = 210000;

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Шифрует строку: { iv, data } в base64. Бросает только при отсутствии subtle. */
export async function encryptString(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { iv: b64(iv), data: b64(new Uint8Array(ct)) };
}

/** Расшифровывает. Неверный ключ/битые данные → null (не бросает). */
export async function decryptString(box, key) {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data));
    return dec.decode(pt);
  } catch {
    return null;
  }
}

/**
 * Настройка шифрования: из парольной фразы делает { key, salt, verifier }.
 * verifier — шифровка известной строки: по ней отличаем верную фразу от неверной,
 * не храня ни фразу, ни ключ.
 */
export async function setupEncryption(passphrase, existingSalt = '') {
  const salt = existingSalt || b64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(passphrase, salt);
  const verifier = await encryptString('1mesto-flow-journal-v1', key);
  return { key, salt, verifier, iterations: ITERATIONS };
}

/** Проверяет фразу против верификатора: true = фраза верная. */
export async function verifyPassphrase(passphrase, salt, verifier) {
  const key = await deriveKey(passphrase, salt);
  const probe = await decryptString(verifier, key);
  return probe === '1mesto-flow-journal-v1';
}
