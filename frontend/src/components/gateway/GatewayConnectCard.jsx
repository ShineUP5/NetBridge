import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import { StatusBadge } from '../StatusBadge'
import {
  downloadHelperSetup,
  helperWasInstalled,
  launchHelperProtocol,
  markHelperInstalled,
  shouldAutoStartHelper,
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
  const autoStarted = useRef(false)

  useEffect(() => {
    if (status?.device_name) setDeviceName(status.device_name)
  }, [status?.device_name])

  useEffect(() => {
    if (agentOnline) markHelperInstalled()
  }, [agentOnline])

  const live = Boolean(status?.is_live || (status?.is_connected && status?.hotspot_active))

  async function startHelperFlow({ quiet = false } = {}) {
    setHelperBusy(true)
    if (!quiet) {
      setHelperMsg('Starting helper on this PC…')
    }
    launchHelperProtocol()
    const ok = await waitForHelper(() => agentApi.health(), { timeoutMs: 35000 })
    if (ok) {
      setHelperMsg('Helper is running. You can start sharing now.')
      onHelperReady?.()
    } else if (!quiet) {
      setHelperMsg(
        'Helper is not running yet. Tap “Install helper once” (one time only), then reload this page.',
      )
    } else {
      setHelperMsg('Waiting for helper… If this stays off, tap Start helper or Install helper once.')
    }
    setHelperBusy(false)
    return ok
  }

  // Auto-start helper when the SERVER page opens (after one-time install).
  useEffect(() => {
    if (live || agentOnline || autoStarted.current) return undefined
    if (!shouldAutoStartHelper()) return undefined
    autoStarted.current = true
    let cancelled = false
    ;(async () => {
      // Quick check first
      const health = await agentApi.health()
      if (cancelled) return
      if (health?.ok) {
        markHelperInstalled()
        onHelperReady?.()
        return
      }
      setHelperMsg('Starting helper automatically…')
      await startHelperFlow({ quiet: true })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, agentOnline])

  function handleInstallOnce() {
    downloadHelperSetup()
    setHelperMsg(
      'Download started. Run Setup-NetBridge-Helper.bat once and click Yes. After that the helper starts by itself when you use NetBridge.',
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
          If phones show “Connected without internet”, have them set DNS to 8.8.8.8 on that
          WiFi. Voucher WiFi (sign-in networks like HOLY SPOT) may block sharing — Ethernet
          or a normal home router works best.
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
            {helperBusy
              ? 'Starting the helper automatically on this PC…'
              : 'Helper is off. NetBridge will try to start it for you — install once if this is the first time on this computer.'}
          </p>
          <div className="helper-actions">
            <Button
              type="button"
              disabled={helperBusy || loading}
              onClick={() => startHelperFlow({ quiet: false })}
            >
              {helperBusy ? 'Starting…' : 'Start helper'}
            </Button>
            <Button type="button" variant="ghost" disabled={helperBusy} onClick={handleInstallOnce}>
              {helperWasInstalled() ? 'Reinstall auto-start' : 'Install helper once'}
            </Button>
          </div>
          {helperMsg ? <p className="muted helper-msg">{helperMsg}</p> : null}
          <p className="muted">
            After one install, the helper starts when you sign into Windows and when you open this page.
            If Chrome asks to allow local network / localhost access for NetBridge, choose Allow.
          </p>
        </div>
      ) : (
        <p className="muted">
          Helper is ready. Friends will only get internet, not your files.
          If Start sharing fails, allow local network access for this site in Chrome site settings.
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
