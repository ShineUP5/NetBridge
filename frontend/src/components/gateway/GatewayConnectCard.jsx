import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { StatusBadge } from '../StatusBadge'

export function GatewayConnectCard({
  status,
  agentOnline,
  onConnect,
  onDisconnect,
  loading,
}) {
  const [deviceName, setDeviceName] = useState(status?.device_name || 'My PC')

  useEffect(() => {
    if (status?.device_name) setDeviceName(status.device_name)
  }, [status?.device_name])

  const live = Boolean(status?.is_live || (status?.is_connected && status?.hotspot_active))

  if (live) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>Your PC</h2>
          <StatusBadge connected />
        </div>
        <p className="lead">
          You are sharing internet from this computer. Friends can browse online, but
          cannot open your files.
        </p>
        <ul className="facts compact">
          <li>
            <strong>Computer</strong>
            <span>{status.hostname || status.device_name}</span>
          </li>
          <li>
            <strong>Your WiFi</strong>
            <span>{status.uplink_profile || status.uplink_alias || '—'}</span>
          </li>
          <li>
            <strong>Share name</strong>
            <span>{status.hotspot_ssid || '—'}</span>
          </li>
          <li>
            <strong>Share password</strong>
            <span>{status.hotspot_password || '—'}</span>
          </li>
          <li>
            <strong>Coverage band</strong>
            <span>{status.hotspot_band || '2.4 GHz preferred'}</span>
          </li>
          <li>
            <strong>Friends online</strong>
            <span>{status.client_count ?? 0}</span>
          </li>
        </ul>
        <p className="muted">
          Approved friends receive this WiFi name and password to get real internet.
        </p>
        <Button variant="ghost" disabled={loading} onClick={onDisconnect}>
          {loading ? 'Stopping…' : 'Stop sharing'}
        </Button>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Start sharing</h2>
        <StatusBadge connected={false} />
      </div>
      <p className="lead">
        Turn on sharing from this computer so friends can use your internet.
      </p>

      {!agentOnline ? (
        <p className="info banner">
          Please start the NetBridge helper first. Double-click
          {' '}
          <code>gateway_agent\start_agent.bat</code>
          {' '}
          and allow Administrator permission.
        </p>
      ) : (
        <p className="muted">
          Helper is ready. Friends will only get internet, not your files.
        </p>
      )}

      <label>
        Name for this computer
        <input
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="My PC"
        />
      </label>
      <Button disabled={loading || !agentOnline} onClick={() => onConnect(deviceName)}>
        {loading ? 'Starting…' : 'Start sharing'}
      </Button>
    </section>
  )
}
