# One-time setup for non-technical users:
# - Scheduled task: helper auto-starts at Windows sign-in (Administrator, no extra clicks)
# - netbridge://start: website can start helper without UAC after install
# - Desktop shortcut

$ErrorActionPreference = 'Stop'

$agentDir = $PSScriptRoot
$root = Split-Path -Parent $agentDir
$startScript = Join-Path $agentDir 'start_agent.ps1'
$silentScript = Join-Path $agentDir 'run_helper_silent.ps1'
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$taskName = 'NetBridgeHelper'

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

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host 'Click Yes ONCE to install auto-start for NetBridge helper...'
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`""
  )
  exit 0
}

# Scheduled task — runs elevated at every Windows sign-in (no UAC each time)
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$startScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 365)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $taskPrincipal `
  -Settings $settings `
  -Force | Out-Null

# Protocol points at silent runner (uses scheduled task → usually no UAC)
$protocolCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$silentScript`""
New-Item -Path 'HKLM:\SOFTWARE\Classes\netbridge' -Force | Out-Null
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Classes\netbridge' -Name '(default)' -Value 'URL:NetBridge Helper'
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Classes\netbridge' -Name 'URL Protocol' -Value ''
New-Item -Path 'HKLM:\SOFTWARE\Classes\netbridge\shell\open\command' -Force | Out-Null
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Classes\netbridge\shell\open\command' -Name '(default)' -Value $protocolCmd

# Also register for current user
New-Item -Path 'HKCU:\SOFTWARE\Classes\netbridge' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\netbridge' -Name '(default)' -Value 'URL:NetBridge Helper'
Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\netbridge' -Name 'URL Protocol' -Value ''
New-Item -Path 'HKCU:\SOFTWARE\Classes\netbridge\shell\open\command' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\netbridge\shell\open\command' -Name '(default)' -Value $protocolCmd

# Desktop shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Start NetBridge Helper.lnk'
$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$silentScript`""
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start NetBridge helper automatically'
$shortcut.Save()

$startMenu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'
$startShortcut = Join-Path $startMenu 'Start NetBridge Helper.lnk'
$sm = $wshell.CreateShortcut($startShortcut)
$sm.TargetPath = 'powershell.exe'
$sm.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$silentScript`""
$sm.WorkingDirectory = $root
$sm.Description = 'Start NetBridge helper automatically'
$sm.Save()

Write-Host ''
Write-Host 'NetBridge helper auto-start is installed.'
Write-Host '- Starts when you sign into Windows'
Write-Host '- Website can start it without digging through folders'
Write-Host '- Desktop shortcut: Start NetBridge Helper'
Write-Host ''
Write-Host 'Starting helper now...'
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2
Write-Host 'Done. You can close this window and use NetBridge in the browser.'
Start-Sleep -Seconds 3
