#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 1mesto Flow team (veberonin)
# Установка 1mesto Flow одной командой (macOS / Linux):
#   curl -fsSL https://raw.githubusercontent.com/veberonin/1mesto.ai/main/scripts/install.sh | bash
# или: bash scripts/install.sh [версия]
set -euo pipefail

REPO="veberonin/1mesto.ai"
VERSION="${1:-latest}"
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PATTERN='\.dmg$' ;;
  Linux)  PATTERN='\.AppImage$' ;;
  *) echo "ОС $OS не поддерживается скриптом — скачай вручную: https://github.com/$REPO/releases" >&2; exit 1 ;;
esac

API="https://api.github.com/repos/$REPO/releases"
if [ "$VERSION" = "latest" ]; then URL="$API/latest"; else URL="$API/tags/$VERSION"; fi

echo "→ Ищу релиз: $URL"
ASSET_URL=$(curl -fsSL "$URL" | grep -o "\"browser_download_url\": *\"[^\"]*\"" | cut -d'"' -f4 | grep -E "$PATTERN" | head -1)
[ -n "$ASSET_URL" ] || { echo "Ассет не найден ($PATTERN)" >&2; exit 1; }

FILE="$(basename "$ASSET_URL")"
echo "→ Скачиваю $FILE"
curl -fL --progress-bar -o "$FILE" "$ASSET_URL"

if [ "$OS" = "Linux" ]; then
  chmod +x "$FILE"
  echo "✓ Готово: ./$FILE"
  echo "  Запуск: ./$FILE  (или перенеси в ~/.local/bin для доступа из меню)"
  if command -v lolcat >/dev/null 2>&1; then echo "  Совет: AppImage сам предложит интеграцию в систему"; fi
else
  echo "✓ Готово: ./$FILE — открой и перетащи приложение в Applications"
  open "$FILE" 2>/dev/null || true
fi
echo "Архитектура: $ARCH · После установки: Settings → Распознавание → скачать модель (офлайн)"
