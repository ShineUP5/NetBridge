# One-time setup for non-technical users:
# - Registers netbridge://start so the website can open the helper
# - Creates a Desktop shortcut "Start NetBridge Helper"
# - Starts the helper with Administrator permission

$ErrorActionPreference = 'Stop'

$agentDir = $PSScriptRoot
$root = Split-Path -Parent $agentDir
$startScript = Join-Path $agentDir 'start_agent.ps1'
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $startScript)) {
  Write-Host 'Could not find start_agent.ps1 next to this installer.'
  pause
  exit 1
}

if (-not (Test-Path $python)) {
  Write-Host 'Python environment missing. On this PC run setup in the NetBridge backend folder first.'
  pause
  exit 1
}

# Elevate for protocol + shortcut install
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host 'Click Yes so NetBridge can install the helper button for your browser...'
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`""
  )
  exit 0
}

$protocolCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File `"$startScript`""

# Custom URL protocol — website button can open: netbridge://start
New-Item -Path 'HKLM:\SOFTWARE\Classes\netbridge' -Force | Out-Null
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Classes\netbridge' -Name '(default)' -Value 'URL:NetBridge Helper'
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Classes\netbridge' -Name 'URL Protocol' -Value ''
New-Item -Path 'HKLM:\SOFTWARE\Classes\netbridge\shell\open\command' -Force | Out-Null
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Classes\netbridge\shell\open\command' -Name '(default)' -Value $protocolCmd

# Desktop shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Start NetBridge Helper.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 1
$shortcut.Description = 'Start NetBridge helper (Administrator)'
$shortcut.Save()

# Start Menu shortcut
$startMenu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'
$startShortcut = Join-Path $startMenu 'Start NetBridge Helper.lnk'
$sm = $shell.CreateShortcut($startShortcut)
$sm.TargetPath = 'powershell.exe'
$sm.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$sm.WorkingDirectory = $root
$sm.Description = 'Start NetBridge helper (Administrator)'
$sm.Save()

Write-Host ''
Write-Host 'NetBridge helper is installed.'
Write-Host '- Desktop shortcut: Start NetBridge Helper'
Write-Host '- Website button can now start it (netbridge://start)'
Write-Host ''
Write-Host 'Starting helper now. Click Yes if Windows asks again...'
Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', "`"$startScript`""
)
