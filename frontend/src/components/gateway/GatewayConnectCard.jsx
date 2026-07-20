import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { StatusBadge } from '../StatusBadge'
import {
  downloadHelperSetup,
  helperWasInstalled,
  launchHelperProtocol,
  markHelperInstalled,
  waitForHelper,
} from '../../utils/helperLaunch'
import { agentApi } from '../../api/agent'

export function GatewayConnectCard({
  status,
  agentOnline,
  onConnect,
  onDisconnect,
  loading,
  onHelperReady,
}) {
  const [deviceName, setDeviceName] = useState(status?.device_name || 'My PC')
  const [helperBusy, setHelperBusy] = useState(false)
  const [helperMsg, setHelperMsg] = useState('')

  useEffect(() => {
    if (status?.device_name) setDeviceName(status.device_name)
  }, [status?.device_name])

  useEffect(() => {
    if (agentOnline) markHelperInstalled()
  }, [agentOnline])

  const live = Boolean(status?.is_live || (status?.is_connected && status?.hotspot_active))

  async function handleStartHelper() {
    setHelperBusy(true)
    setHelperMsg('Opening helper… click Yes if Windows asks for permission.')
    launchHelperProtocol()
    const ok = await waitForHelper(() => agentApi.health(), { timeoutMs: 28000 })
    if (ok) {
      setHelperMsg('Helper is running. You can start sharing now.')
      onHelperReady?.()
    } else {
      setHelperMsg(
        'Helper did not start yet. Tap “Install helper once”, run that file, then tap Start helper again.',
      )
    }
    setHelperBusy(false)
  }

  function handleInstallOnce() {
    downloadHelperSetup()
    setHelperMsg(
      'Download started. Run Setup-NetBridge-Helper.bat once (click Yes), then come back and tap Start helper.',
    )
  }

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
        <div className="helper-launch">
          <p className="info banner">
            The helper must run on this PC (one black window). Tap the button below — no need to dig through folders each time.
          </p>
          <div className="helper-actions">
            <Button type="button" disabled={helperBusy || loading} onClick={handleStartHelper}>
              {helperBusy ? 'Starting helper…' : 'Start helper'}
            </Button>
            <Button type="button" variant="ghost" disabled={helperBusy} onClick={handleInstallOnce}>
              {helperWasInstalled() ? 'Reinstall helper' : 'Install helper once'}
            </Button>
          </div>
          {helperMsg ? <p className="muted helper-msg">{helperMsg}</p> : null}
          <p className="muted">
            First time only: Install helper once → click Yes → then Start helper whenever you share.
          </p>
        </div>
      ) : (
        <p className="muted">Helper is ready. Friends will only get internet, not your files.</p>
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
