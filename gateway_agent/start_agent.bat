@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_agent.ps1"
if errorlevel 1 (
  echo.
  echo Helper failed to start. See the message above.
  pause
)
