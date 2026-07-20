@echo off
REM One-time install for non-technical users.
REM Double-click this once, click Yes, then use the website "Start helper" button.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_helper.ps1"
