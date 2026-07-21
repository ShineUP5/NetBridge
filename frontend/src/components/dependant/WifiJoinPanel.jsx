import { useState } from 'react'
import { Button } from '../Button'
import { copyText } from '../../utils/copyText'

export function WifiJoinPanel({ wifi }) {
  const [copied, setCopied] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  if (!wifi) return null

  if (!wifi.ready) {
    return (
      <section className="panel dependant-panel wifi-panel">
        <div className="panel-head">
          <h2>Join WiFi</h2>
        </div>
        <p className="lead">{wifi.message}</p>
      </section>
    )
  }

  async function copyValue(kind, value) {
    await copyText(value)
    setCopied(kind)
    setTimeout(() => setCopied(''), 2000)
  }

  async function testInternet() {
    setTesting(true)
    setTestResult(null)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(`https://connectivitycheck.gstatic.com/generate_204?_=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller.signal,
      })
      clearTimeout(timer)
      // no-cors opaque response still means the network request left the device
      setTestResult({
        ok: true,
        message: 'Your phone reached the internet. You are online through your friend.',
      })
      void response
    } catch {
      try {
        const response = await fetch(`https://www.msftconnecttest.com/connecttest.txt?_=${Date.now()}`, {
          cache: 'no-store',
          mode: 'no-cors',
        })
        setTestResult({
          ok: true,
          message: 'Your phone reached the internet. You are online through your friend.',
        })
        void response
      } catch {
        setTestResult({
          ok: false,
          message: 'Not online yet. Join the WiFi below, wait a few seconds, then test again.',
        })
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="panel dependant-panel wifi-panel">
      <div className="panel-head">
        <h2>Join WiFi for real internet</h2>
      </div>
      <p className="lead">
        You are approved. Join this WiFi on your phone to use your friend’s internet.
      </p>

      <p className="info banner">
        Phone shows “Connected without internet”? On the WiFi settings for this network, set
        DNS manually to <strong>8.8.8.8</strong> and <strong>8.8.4.4</strong>, then wait 15
        seconds and tap Test internet below.
      </p>

      <ol className="wifi-steps">
        <li>Turn off mobile data on this phone (so it must use WiFi)</li>
        <li>Open WiFi settings and join the network below</li>
        <li>Enter the password below</li>
        <li>
          If it says “without internet”: tap the gear → Advanced → DNS → set Manual to
          8.8.8.8 and 8.8.4.4
        </li>
        <li>Wait 10–15 seconds, then tap Test internet</li>
      </ol>

      <div className="wifi-cred">
        <div>
          <span className="muted">WiFi name</span>
          <strong className="wifi-value">{wifi.ssid}</strong>
        </div>
        <Button variant="ghost" onClick={() => copyValue('ssid', wifi.ssid)}>
          {copied === 'ssid' ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div className="wifi-cred">
        <div>
          <span className="muted">Password</span>
          <strong className="wifi-value">{wifi.password}</strong>
        </div>
        <Button variant="ghost" onClick={() => copyValue('password', wifi.password)}>
          {copied === 'password' ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <Button className="dependant-submit" disabled={testing} onClick={testInternet}>
        {testing ? 'Testing…' : 'Test internet'}
      </Button>

      {testResult ? (
        <p className={testResult.ok ? 'info banner' : 'error banner'}>{testResult.message}</p>
      ) : null}
    </section>
  )
}
