# Starts the NetBridge helper with Administrator rights
# so friends can use internet only (not files on this PC).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }

$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$agent = Join-Path $PSScriptRoot 'agent.py'
$agentPort = 8765

if (-not (Test-Path $python)) {
  Write-Host 'Python virtual environment not found. Create backend\.venv first.'
  exit 1
}

# Relaunch elevated if needed.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host 'Requesting Administrator permission for safe sharing...'
  Write-Host 'Click Yes on the Windows popup, then wait for the black helper window.'
  Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @(
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', "`"$PSCommandPath`""
    ) `
    -Verb RunAs
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
    $pid = $row.OwningProcess
    if ($pid -and $pid -ne 0) {
      Write-Host "Stopping old helper on port $Port (PID $pid)..."
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 1
}

Set-Location $root
Stop-HelperOnPort -Port $agentPort
Write-Host ''
Write-Host 'NetBridge helper starting with Administrator protection...'
Write-Host "Keep this window open. Gateway page: http://127.0.0.1:$agentPort"
Write-Host ''
& $python $agent
