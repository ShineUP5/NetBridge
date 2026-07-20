$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

function Await-WinRt($op) {
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  $asTask = $asTaskGeneric.MakeGenericMethod($op.GetType().GenericTypeArguments)
  $task = $asTask.Invoke($null, @($op))
  $task.GetAwaiter().GetResult()
}

try {
  $null = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
  $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]

  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if (-not $profile) {
    Write-Output '{"ok":false,"error":"No active internet connection profile on this PC."}'
    exit 0
  }

  $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  $cfg = $tm.GetCurrentAccessPointConfiguration()
  $result = [ordered]@{
    ok = $true
    profile_name = $profile.ProfileName
    connectivity = [string]$profile.GetNetworkConnectivityLevel()
    tether_state = [string]$tm.TetheringOperationalState
    client_count = $tm.ClientCount
    ssid = $cfg.Ssid
    max_clients = $tm.MaxClientCount
  }
  $result | ConvertTo-Json -Compress
} catch {
  $msg = $_.Exception.Message
  Write-Output ("{`"ok`":false,`"error`":`"$msg`"}")
}
