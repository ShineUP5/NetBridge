@echo off
REM Downloaded from the NetBridge website — first-time setup helper.
REM Saves instructions and opens the install path if NetBridge is already on this PC.

setlocal
set "FOUND="

if exist "%LOCALAPPDATA%\NetBridge\gateway_agent\Install NetBridge Helper.bat" (
  set "FOUND=%LOCALAPPDATA%\NetBridge\gateway_agent\Install NetBridge Helper.bat"
)
if exist "%USERPROFILE%\Documents\PROJECTS\WiFi_Extension\gateway_agent\Install NetBridge Helper.bat" (
  set "FOUND=%USERPROFILE%\Documents\PROJECTS\WiFi_Extension\gateway_agent\Install NetBridge Helper.bat"
)
if exist "%USERPROFILE%\Documents\PROJECTS\NetBridge\gateway_agent\Install NetBridge Helper.bat" (
  set "FOUND=%USERPROFILE%\Documents\PROJECTS\NetBridge\gateway_agent\Install NetBridge Helper.bat"
)
if exist "%USERPROFILE%\Desktop\NetBridge\gateway_agent\Install NetBridge Helper.bat" (
  set "FOUND=%USERPROFILE%\Desktop\NetBridge\gateway_agent\Install NetBridge Helper.bat"
)

echo.
echo  NetBridge helper setup
echo  ----------------------
echo.

if defined FOUND (
  echo  Found NetBridge on this PC.
  echo  Starting one-time install...
  echo.
  call "%FOUND%"
  exit /b %ERRORLEVEL%
)

echo  NetBridge is not installed on this PC yet.
echo.
echo  Do this once:
echo   1. Download / clone NetBridge onto this computer
echo   2. Open the folder: gateway_agent
echo   3. Double-click:  Install NetBridge Helper.bat
echo   4. Click Yes when Windows asks
echo.
echo  After that, the website "Start helper" button will work.
echo.
pause
