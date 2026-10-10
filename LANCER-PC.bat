@echo off
chcp 65001 >nul
title ZéroPaperasse
cd /d "%~dp0"
echo.
echo   ============================================
echo    ZéroPaperasse — serveur local
echo.
echo    Sur ce PC ....... http://localhost:8080
for /f "tokens=2 delims=: " %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo    Sur ton tel ..... http://%%a:8080
echo.
echo    (même WiFi pour le téléphone — Ctrl+C pour arrêter)
echo   ============================================
echo.
start "" http://localhost:8080
python -m http.server 8080 --bind 0.0.0.0
pause
