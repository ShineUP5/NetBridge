param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('status', 'start', 'stop')]
  [string]$Action,

  [string]$Ssid = '',
  [string]$Password = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

$null = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.TetheringOperationStatus,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]

function Start-Tethering([object]$tm) {
  if ([string]$tm.TetheringOperationalState -eq 'On') {
    return
  }
  # Fire-and-poll avoids fragile WinRT AsTask casting on some Windows builds.
  $null = $tm.StartTetheringAsync()
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    if ([string]$tm.TetheringOperationalState -eq 'On') {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw 'Failed to start Mobile Hotspot in time. Open Settings > Mobile hotspot, turn it on once, then retry.'
}

function Stop-Tethering([object]$tm) {
  if ([string]$tm.TetheringOperationalState -ne 'On') {
    return
  }
  $null = $tm.StopTetheringAsync()
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if ([string]$tm.TetheringOperationalState -eq 'Off') {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw 'Failed to stop Mobile Hotspot in time.'
}

function Get-TetheringManager {
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if (-not $profile) {
    throw 'No active internet connection on this PC. Connect to WiFi or Ethernet first.'
  }

  $level = [string]$profile.GetNetworkConnectivityLevel()
  if ($level -ne 'InternetAccess') {
    throw "This PC does not have internet access yet (status: $level)."
  }

  $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  return @{
    Manager = $tm
    Profile = $profile
  }
}

function Get-UplinkInfo {
  $uplink = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1

  if (-not $uplink) {
    return @{
      alias = ''
      description = ''
      ipv4 = ''
      mac = ''
    }
  }

  $ipv4 = ''
  if ($uplink.IPv4Address) {
    $ipv4 = [string]$uplink.IPv4Address[0].IPAddress
  }

  $mac = ''
  try {
    $mac = [string](Get-NetAdapter -InterfaceIndex $uplink.InterfaceIndex -ErrorAction Stop).MacAddress
  } catch {
    $mac = ''
  }

  return @{
    alias = [string]$uplink.InterfaceAlias
    description = [string]$uplink.InterfaceDescription
    ipv4 = $ipv4
    mac = $mac
  }
}

function Get-ShareAdapters {
  # Mobile Hotspot / ICS virtual adapters used for clients (never the voucher uplink).
  Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Status -eq 'Up' -and (
        $_.InterfaceDescription -match 'Wi-Fi Direct Virtual|Microsoft Hosted Network|Virtual Adapter' -or
        $_.Name -match 'Local Area Connection\*'
      )
    }
}

function Ensure-IcsService {
  $svc = Get-Service -Name SharedAccess -ErrorAction SilentlyContinue
  if (-not $svc) {
    return $false
  }
  if ($svc.Status -ne 'Running') {
    try {
      Start-Service SharedAccess -ErrorAction Stop
    } catch {
      return $false
    }
  }
  return $true
}

function Disable-Ipv6OnAdapter([string]$alias) {
  if (-not $alias) { return $false }
  try {
    $binding = Get-NetAdapterBinding -Name $alias -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
    if ($binding -and $binding.Enabled) {
      Disable-NetAdapterBinding -Name $alias -ComponentID ms_tcpip6 -ErrorAction Stop
    }
    return $true
  } catch {
    return $false
  }
}

function Get-HotspotSubnets {
  $subnets = New-Object System.Collections.Generic.List[string]
  [void]$subnets.Add('192.168.137.0/24')

  foreach ($adapter in @(Get-ShareAdapters)) {
    $addrs = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '169.254*' }
    foreach ($addr in $addrs) {
      try {
        $parts = $addr.IPAddress.Split('.')
        if ($parts.Count -eq 4 -and [int]$addr.PrefixLength -ge 8) {
          $maskBits = [int]$addr.PrefixLength
          if ($maskBits -eq 24) {
            [void]$subnets.Add("$($parts[0]).$($parts[1]).$($parts[2]).0/24")
          } elseif ($maskBits -eq 16) {
            [void]$subnets.Add("$($parts[0]).$($parts[1]).0.0/16")
          } else {
            [void]$subnets.Add("$($parts[0]).$($parts[1]).$($parts[2]).0/24")
          }
        }
      } catch {
        # ignore parse issues
      }
    }
  }

  return @($subnets | Select-Object -Unique)
}

function Disable-HostSharingOnAdapter([string]$alias) {
  if (-not $alias) { return }
  foreach ($component in @('ms_server', 'ms_netbios', 'ms_msclient', 'ms_lltdio', 'ms_rspndr')) {
    try {
      $binding = Get-NetAdapterBinding -Name $alias -ComponentID $component -ErrorAction SilentlyContinue
      if ($binding -and $binding.Enabled) {
        Disable-NetAdapterBinding -Name $alias -ComponentID $component -ErrorAction SilentlyContinue
      }
    } catch {
      # best effort
    }
  }
}

function Apply-HostIsolation {
  $applied = $false
  $subnets = @(Get-HotspotSubnets)

  foreach ($adapter in @(Get-ShareAdapters)) {
    Disable-HostSharingOnAdapter $adapter.Name
  }

  Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'NetBridge Isolate*' -or $_.DisplayName -like 'NetBridge Allow Hotspot*' } |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue

  foreach ($subnet in $subnets) {
    $tcpName = "NetBridge Isolate Host TCP ($subnet)"
    $dnsName = "NetBridge Allow Hotspot DNS TCP ($subnet)"
    $udpName = "NetBridge Isolate Host UDP discovery ($subnet)"

    try {
      New-NetFirewallRule `
        -DisplayName $tcpName `
        -Direction Inbound `
        -Action Block `
        -Protocol TCP `
        -RemoteAddress $subnet `
        -Profile Any `
        -ErrorAction Stop | Out-Null

      New-NetFirewallRule `
        -DisplayName $dnsName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 53 `
        -RemoteAddress $subnet `
        -Profile Any `
        -ErrorAction SilentlyContinue | Out-Null

      New-NetFirewallRule `
        -DisplayName $udpName `
        -Direction Inbound `
        -Action Block `
        -Protocol UDP `
        -LocalPort 137,138,139,445,1900,2869,3702,5353,5355,5357 `
        -RemoteAddress $subnet `
        -Profile Any `
        -ErrorAction SilentlyContinue | Out-Null

      $applied = $true
      continue
    } catch {
      # Fall back to netsh (still needs Administrator).
    }

    $netshTcp = netsh advfirewall firewall add rule name="$tcpName" dir=in action=block protocol=TCP remoteip=$subnet 2>&1
    if ($LASTEXITCODE -eq 0) {
      netsh advfirewall firewall add rule name="$dnsName" dir=in action=allow protocol=TCP localport=53 remoteip=$subnet | Out-Null
      netsh advfirewall firewall add rule name="$udpName" dir=in action=block protocol=UDP localport=137,138,139,445,1900,2869,3702,5353,5355,5357 remoteip=$subnet | Out-Null
      $applied = $true
    }
  }

  return $applied
}

function Get-PrivacyStatusQuick([string]$uplinkAlias) {
  # Fast path for polling — do not rebuild firewall rules every few seconds.
  $notes = New-Object System.Collections.Generic.List[string]
  $icsRunning = $false
  try {
    $svc = Get-Service -Name SharedAccess -ErrorAction SilentlyContinue
    $icsRunning = $svc -and $svc.Status -eq 'Running'
  } catch { }

  $shareAdapters = @(Get-ShareAdapters)
  $isolationActive = $false
  try {
    $isolationActive = [bool](Get-NetFirewallRule -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like 'NetBridge Isolate*' } |
      Select-Object -First 1)
  } catch { }

  if ($icsRunning) { $notes.Add('Internet sharing is on.') }
  if ($isolationActive) {
    $notes.Add('Friends only get internet. They cannot open files on this computer.')
  } else {
    $notes.Add('Start the NetBridge helper with Administrator permission to protect your files.')
  }

  $natOk = $icsRunning -or ($shareAdapters.Count -gt 0)
  return @{
    nat_active = [bool]$natOk
    ipv6_leak_blocked = $true
    privacy_shield_active = [bool]$natOk
    client_isolation_active = [bool]$isolationActive
    ics_running = [bool]$icsRunning
    share_adapter_count = $shareAdapters.Count
    notes = ($notes -join ' ')
  }
}

function Apply-PrivacyShield([string]$uplinkAlias) {
  $notes = New-Object System.Collections.Generic.List[string]
  $ipv6Disabled = $false
  $icsRunning = Ensure-IcsService
  if ($icsRunning) {
    $notes.Add('Internet sharing is on.')
  }

  $shareAdapters = @(Get-ShareAdapters)
  foreach ($adapter in $shareAdapters) {
    if (Disable-Ipv6OnAdapter $adapter.Name) {
      $ipv6Disabled = $true
    }
  }

  if ($uplinkAlias -and (Disable-Ipv6OnAdapter $uplinkAlias)) {
    $ipv6Disabled = $true
  }

  $isolationActive = Apply-HostIsolation
    if ($isolationActive) {
    $notes.Add('Friends only get internet. They cannot open files on this computer.')
  } else {
    $notes.Add('Start the NetBridge helper with Administrator permission to protect your files.')
  }

  $ruleName = 'NetBridge Block Outbound IPv6'
  try {
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
      New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol ICMPv6 -Action Block -Profile Any -ErrorAction SilentlyContinue | Out-Null
      New-NetFirewallRule -DisplayName "$ruleName TCP" -Direction Outbound -Protocol TCP -RemoteAddress ::/0 -Action Block -Profile Any -ErrorAction SilentlyContinue | Out-Null
      New-NetFirewallRule -DisplayName "$ruleName UDP" -Direction Outbound -Protocol UDP -RemoteAddress ::/0 -Action Block -Profile Any -ErrorAction SilentlyContinue | Out-Null
    }
  } catch {
    # optional
  }

  $natOk = $icsRunning -or ($shareAdapters.Count -gt 0)
  $shieldActive = $natOk

  return @{
    nat_active = [bool]$natOk
    ipv6_leak_blocked = [bool]$ipv6Disabled
    privacy_shield_active = [bool]$shieldActive
    client_isolation_active = [bool]$isolationActive
    ics_running = [bool]$icsRunning
    share_adapter_count = $shareAdapters.Count
    notes = ($notes -join ' ')
  }
}

function Remove-PrivacyFirewallRules {
  Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object {
      $_.DisplayName -like 'NetBridge Block Outbound IPv6*' -or
      $_.DisplayName -like 'NetBridge Isolate*' -or
      $_.DisplayName -like 'NetBridge Allow Hotspot*'
    } |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue
}

function Optimize-Coverage([object]$cfg) {
  # Prefer 2.4 GHz: longer reach through walls than 5/6 GHz on a laptop hotspot.
  $bandLabel = 'auto'
  $bandForced = $false
  $notes = New-Object System.Collections.Generic.List[string]

  try {
    $twoFour = [Windows.Networking.NetworkOperators.TetheringWiFiBand]::TwoPointFourGigahertz
    $supported = $true
    try {
      $supported = [bool]$cfg.IsBandSupported($twoFour)
    } catch {
      $supported = $true
    }
    if ($supported) {
      $cfg.Band = $twoFour
      $bandLabel = '2.4 GHz'
      $bandForced = $true
      $notes.Add('Hotspot locked to 2.4 GHz for wider indoor range.')
    } else {
      $notes.Add('This WiFi adapter does not allow forcing 2.4 GHz; using the system band.')
    }
  } catch {
    try {
      # Numeric fallback (TwoPointFourGigahertz = 1) on older PowerShell/WinRT bindings.
      $cfg.Band = 1
      $bandLabel = '2.4 GHz'
      $bandForced = $true
      $notes.Add('Hotspot locked to 2.4 GHz for wider indoor range.')
    } catch {
      $notes.Add('Could not set WiFi band; Windows will choose automatically.')
    }
  }

  # Raise transmit power where the driver exposes it (vendor-specific names).
  $txBoosted = $false
  $powerNames = @(
    'Transmit Power',
    'Transmit Power Level',
    'Output Power',
    'Tx Power Level'
  )
  $powerValues = @('Highest', '100%', '5. Highest', 'Maximum', 'Full', '100')
  $adapters = Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Status -eq 'Up' -and (
        $_.InterfaceDescription -match 'Wi-?Fi|Wireless|802\.11' -or
        $_.Name -match 'Wi-?Fi|Wireless'
      )
    }
  foreach ($adapter in @($adapters)) {
    foreach ($propName in $powerNames) {
      foreach ($val in $powerValues) {
        try {
          Set-NetAdapterAdvancedProperty -Name $adapter.Name -DisplayName $propName -DisplayValue $val -ErrorAction Stop | Out-Null
          $txBoosted = $true
          break
        } catch {
          # try next value / property name
        }
      }
      if ($txBoosted) { break }
    }
    if ($txBoosted) { break }
  }
  if ($txBoosted) {
    $notes.Add('WiFi transmit power set as high as this adapter allows.')
  } else {
    $notes.Add('Place this PC centrally and raised up for the best reach (laptop radios are limited).')
  }

  return @{
    band = $bandLabel
    band_forced = $bandForced
    tx_power_boosted = $txBoosted
    notes = ($notes -join ' ')
  }
}

try {
  $bundle = Get-TetheringManager
  $tm = $bundle.Manager
  $profile = $bundle.Profile
  $cfg = $tm.GetCurrentAccessPointConfiguration()
  $uplink = Get-UplinkInfo
  $coverage = @{
    band = 'unknown'
    band_forced = $false
    tx_power_boosted = $false
    notes = ''
  }
  $privacy = @{
    nat_active = $false
    ipv6_leak_blocked = $false
    privacy_shield_active = $false
    client_isolation_active = $false
    ics_running = $false
    share_adapter_count = 0
    notes = ''
  }

  if ($Action -eq 'start') {
    if (-not $Ssid -or -not $Password -or $Password.Length -lt 8) {
      $suffix = -join ((48..57 + 65..90) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
      $Ssid = "NetBridge-$suffix"
      $Password = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 12 | ForEach-Object { [char]$_ })
    }

    $cfg.Ssid = $Ssid
    $cfg.Passphrase = $Password
    $coverage = Optimize-Coverage $cfg
    try {
      $null = $tm.ConfigureAccessPointAsync($cfg)
      Start-Sleep -Milliseconds 1000
    } catch {
      throw "Could not set shared WiFi name/password. Try Start sharing again."
    }
    $cfg = $tm.GetCurrentAccessPointConfiguration()

    Start-Tethering $tm
    Start-Sleep -Milliseconds 1000
    $privacy = Apply-PrivacyShield -uplinkAlias $uplink.alias
  }

  if ($Action -eq 'stop') {
    Stop-Tethering $tm
    Remove-PrivacyFirewallRules
    $privacy.notes = 'Hotspot stopped. Privacy firewall rules cleared.'
  }

  if ($Action -eq 'status' -and [string]$tm.TetheringOperationalState -eq 'On') {
    $privacy = Get-PrivacyStatusQuick -uplinkAlias $uplink.alias
  }

  $cfg = $tm.GetCurrentAccessPointConfiguration()
  $state = [string]$tm.TetheringOperationalState
  $shareIp = ''
  foreach ($adapter in @(Get-ShareAdapters)) {
    $addr = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '169.254*' } |
      Select-Object -First 1
    if ($addr) {
      $shareIp = [string]$addr.IPAddress
      break
    }
  }
  if (-not $shareIp) { $shareIp = '192.168.137.1' }

  $passphrase = ''
  try { $passphrase = [string]$cfg.Passphrase } catch { $passphrase = '' }
  if ($Action -eq 'start' -and $Password) { $passphrase = $Password }

  if ($Action -eq 'start' -or ($Action -eq 'status' -and $state -eq 'On')) {
    try {
      $bandRaw = [string]$cfg.Band
      if ($bandRaw -match 'TwoPointFour|^\s*1\s*$') { $coverage.band = '2.4 GHz' }
      elseif ($bandRaw -match 'Five|^\s*2\s*$') { $coverage.band = '5 GHz' }
      elseif ($bandRaw -match 'Six|^\s*3\s*$') { $coverage.band = '6 GHz' }
      elseif ($coverage.band -eq 'unknown' -and $bandRaw) { $coverage.band = $bandRaw }
    } catch { }
  }

  $payload = [ordered]@{
    ok = $true
    action = $Action
    hostname = $env:COMPUTERNAME
    has_internet = $true
    uplink_profile = $profile.ProfileName
    uplink_alias = $uplink.alias
    uplink_description = $uplink.description
    uplink_ipv4 = $uplink.ipv4
    uplink_mac = $uplink.mac
    hotspot_active = ($state -eq 'On')
    hotspot_state = $state
    hotspot_ssid = $cfg.Ssid
    hotspot_password = $passphrase
    hotspot_band = [string]$coverage.band
    coverage_optimized = [bool]($coverage.band_forced -or $coverage.tx_power_boosted)
    coverage_notes = [string]$coverage.notes
    gateway_lan_ip = $shareIp
    client_count = $tm.ClientCount
    max_clients = $tm.MaxClientCount
    share_mode = 'windows_mobile_hotspot_nat'
    nat_active = [bool]$privacy.nat_active
    ipv6_leak_blocked = [bool]$privacy.ipv6_leak_blocked
    privacy_shield_active = [bool]$privacy.privacy_shield_active
    client_isolation_active = [bool]$privacy.client_isolation_active
    ics_running = [bool]$privacy.ics_running
    share_adapter_count = [int]$privacy.share_adapter_count
    privacy_notes = [string]$privacy.notes
    upstream_visible_identity = "Only this PC ($($uplink.mac) / $($uplink.ipv4)) is visible to the voucher router"
  }
  $payload | ConvertTo-Json -Compress
}
catch {
  $err = $_.Exception.Message.Replace('"', "'")
  Write-Output ("{`"ok`":false,`"error`":`"$err`"}")
  exit 1
}
