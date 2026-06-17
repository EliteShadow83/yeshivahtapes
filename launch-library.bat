@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing website dependencies...
  npm install
)
if "%AUDIO_DIR%"=="" set "AUDIO_DIR=%~dp0audio"
start "Yeshivah Tapes" http://localhost:3131
npm start
