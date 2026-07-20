# Rebuild frontend then start helper (Administrator)

cd /d "%~dp0.."
cd frontend
call npm run build
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_agent.ps1"
