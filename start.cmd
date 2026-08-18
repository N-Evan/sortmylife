@echo off
cd /d "%~dp0"
call npm run build || exit /b 1
set PORT=3000
node build\index.js
