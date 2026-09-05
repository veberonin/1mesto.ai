# 📦 Зависимости

Проект намеренно лёгкий: **3 runtime-зависимости** для сервера и стандартный
React/Vite/Tailwind стек для фронтенда. Все версии зафиксированы в
`package-lock.json` (устанавливай через `npm ci` — воспроизводимая сборка).

## Runtime (сервер)

| Пакет | Версия | Лицензия | Зачем |
|---|---|---|---|
| [express](https://www.npmjs.com/package/express) | ^4.19.2 | MIT | HTTP-сервер: `/api/stats`, `/api/format`, статика |
| [cors](https://www.npmjs.com/package/cors) | ^2.8.5 | MIT | CORS-заголовки для API |
| [dotenv](https://www.npmjs.com/package/dotenv) | ^16.4.5 | MIT | Конфиг из `.env` (AI-ключи, порт) |

## Frontend (devDependencies)

| Пакет | Версия | Лицензия | Зачем |
|---|---|---|---|
| [react](https://www.npmjs.com/package/react) / react-dom | ^18.2.0 | MIT | UI |
| [vite](https://www.npmjs.com/package/vite) | ^5.1.6 | MIT | Дев-сервер и сборка |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | ^4.2.1 | MIT | JSX + Fast Refresh |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) | ^3.4.1 | MIT | Стили |
| [postcss](https://www.npmjs.com/package/postcss) / autoprefixer | ^8.4.38 / ^10.4.19 | MIT | Постобработка CSS |
| [lucide-react](https://www.npmjs.com/package/lucide-react) | ^0.363.0 | ISC | Иконки |
| [concurrently](https://www.npmjs.com/package/concurrently) | ^8.2.2 | MIT | `npm run dev` поднимает сервер+фронт одной командой |

## Без внешних вызовов

Распознавание речи (Web Speech API), звуковая волна (WebAudio), звуки UI
(осцилляторы), умный форматер и статистика — **весь этот код наш собственный,
без сторонних пакетов**. Тесты работают на встроенном раннере Node.js
(`node --test`) — ноль дополнительных зависимостей.

## Аудит

```bash
npm audit          # проверить уязвимости
npm outdated       # проверить обновления
```

AI-интеграции (опционально, выключены по умолчанию): Google Gemini,
OpenAI или локальная [Ollama](https://ollama.com) — вызываются с бэкенда,
ключи не хранятся в репозитории.
