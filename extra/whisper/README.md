# extra/whisper — предустановленный распознаватель

Наполняется скриптом `node scripts/fetch-whisper.mjs` (вызывается в release.yml
перед electron-builder): официальный whisper.cpp + модель ggml-base-q5_1.
Попадает в установщик через extraResources → `<resources>/whisper` —
приложение работает полностью офлайн ИЗ КОРОБКИ, без скачиваний.
