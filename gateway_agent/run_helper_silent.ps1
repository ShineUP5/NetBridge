# Silent launcher used by netbridge://start and the website.
# Uses the installed scheduled task (no UAC popup after one-time install).

$ErrorActionPreference = 'SilentlyContinue'
$taskName = 'NetBridgeHelper'
$agentDir = $PSScriptRoot
$startScript = Join-Path $agentDir 'start_agent.ps1'

function Test-HelperUp {
  try {
    $req = [System.Net.WebRequest]::Create('http://127.0.0.1:8765/health')
    $req.Timeout = 2000
    $resp = $req.GetResponse()
    $resp.Close()
    return $true
  } catch {
    return $false
  }
}

if (Test-HelperUp) {
  exit 0
}

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  if (Test-HelperUp) { exit 0 }
}

# Fallback: elevate start script once
if (Test-Path $startScript) {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$startScript`""
  ) -ErrorAction SilentlyContinue
}

exit 0
