@echo off
REM Downloaded from the NetBridge website — finds NetBridge and installs auto-start (once).

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
echo  NetBridge helper — one-time auto-start setup
echo  ---------------------------------------------
echo.

if defined FOUND (
  echo  Found NetBridge. Installing auto-start...
  echo  Click Yes when Windows asks. After this, the helper starts by itself.
  echo.
  call "%FOUND%"
  exit /b %ERRORLEVEL%
)

echo  Could not find NetBridge on this PC automatically.
echo.
echo  Do this once:
echo   1. Open your NetBridge folder
echo   2. Open: gateway_agent
echo   3. Double-click: Install NetBridge Helper.bat
echo   4. Click Yes
echo.
echo  After that, the helper starts when you sign in — no more folder digging.
echo.
pause
