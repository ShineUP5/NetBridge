# Starts the NetBridge helper with Administrator rights
# so friends can use internet only (not files on this PC).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }

$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$agent = Join-Path $PSScriptRoot 'agent.py'
$agentPort = 8765

function Wait-BeforeClose {
  param([string]$Message = '')
  if ($Message) { Write-Host $Message }
  Write-Host ''
  Read-Host 'Press Enter to close this window'
}

if (-not (Test-Path $python)) {
  Write-Host "Python virtual environment not found at:`n  $python"
  Write-Host 'Create backend\.venv first, then try again.'
  Wait-BeforeClose
  exit 1
}

if (-not (Test-Path $agent)) {
  Write-Host "Helper script missing:`n  $agent"
  Wait-BeforeClose
  exit 1
}

# Relaunch elevated if needed.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host 'Requesting Administrator permission for safe sharing...'
  Write-Host 'Click Yes on the Windows popup, then wait for the black helper window.'
  try {
    Start-Process `
      -FilePath 'powershell.exe' `
      -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$PSCommandPath`""
      ) `
      -Verb RunAs
  } catch {
    Write-Host 'Administrator permission was cancelled or blocked.'
    Wait-BeforeClose
    exit 1
  }
  exit 0
}

function Stop-HelperOnPort {
  param([int]$Port)
  try {
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  } catch {
    $listeners = @()
  }
  foreach ($row in @($listeners)) {
    # Do NOT use $pid — it is a read-only PowerShell automatic variable.
    $procId = $row.OwningProcess
    if ($procId -and $procId -ne 0) {
      Write-Host "Stopping old helper on port $Port (PID $procId)..."
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 1
}

try {
  Set-Location $root
  Stop-HelperOnPort -Port $agentPort

  # Keep website "Start helper" button working (netbridge://start)
  try {
    $protocolCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File `"$PSCommandPath`""
    New-Item -Path 'HKCU:\SOFTWARE\Classes\netbridge' -Force | Out-Null
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\netbridge' -Name '(default)' -Value 'URL:NetBridge Helper'
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\netbridge' -Name 'URL Protocol' -Value ''
    New-Item -Path 'HKCU:\SOFTWARE\Classes\netbridge\shell\open\command' -Force | Out-Null
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\netbridge\shell\open\command' -Name '(default)' -Value $protocolCmd
  } catch {
    # Non-fatal — install_helper.ps1 can register system-wide instead.
  }

  Write-Host ''
  Write-Host 'NetBridge helper starting with Administrator protection...'
  Write-Host "Keep this window open. Gateway page: http://127.0.0.1:$agentPort"
  Write-Host ''
  & $python $agent
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  if ($code -ne 0) {
    Wait-BeforeClose "Helper exited with code $code."
    exit $code
  }
} catch {
  Write-Host ''
  Write-Host 'Helper failed to start:'
  Write-Host $_.Exception.Message
  if ($_.ScriptStackTrace) {
    Write-Host $_.ScriptStackTrace
  }
  Wait-BeforeClose
  exit 1
}
