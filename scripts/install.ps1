# SPDX-License-Identifier: MIT
# Copyright (c) 2026 1mesto Flow team (veberonin)
# Установка 1mesto Flow одной командой (Windows PowerShell):
#   irm https://raw.githubusercontent.com/veberonin/1mesto.ai/main/scripts/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$Repo = 'veberonin/1mesto.ai'
Write-Host '-> Ищу последний релиз...'
$Rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Asset = $Rel.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1
if (-not $Asset) { throw 'Setup .exe не найден в релизе' }
$Out = Join-Path $env:TEMP $Asset.name
Write-Host ("-> Скачиваю {0} ({1:N1} МБ)..." -f $Asset.name, ($Asset.size / 1MB))
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $Out
Write-Host "-> Готово: $Out — запускаю установщик..."
Start-Process $Out -Wait
Write-Host 'Установлено. После запуска: Настройки -> Распознавание -> скачать модель (офлайн).'
