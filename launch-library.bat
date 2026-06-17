@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing website dependencies...
  npm install
)
start "Yeshivah Tapes" http://localhost:3131
npm start
