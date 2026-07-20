import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { wakeApi } from '../api/client'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Shell } from '../components/Shell'
import { useAuth } from '../context/AuthContext'
import DependantPage from './DependantPage'

export default function JoinPage() {
  const { user, booting, login, signup } = useAuth()
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  })

  useEffect(() => {
    wakeApi()
  }, [])

  if (booting) {
    return (
      <Shell className="dependant-shell join-shell">
        <p className="lead">Loading NetBridge…</p>
      </Shell>
    )
  }

  if (user?.role === 'gateway') {
    return <Navigate to="/gateway" replace />
  }

  if (user?.role === 'dependant') {
    return <DependantPage />
  }

  async function onLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginForm)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function onSignup(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup({ ...signupForm, role: 'dependant' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell className="dependant-shell join-shell" narrow>
      <section className="join-hero">
        <Brand to="/join" size="lg" />
        <h1>Join a friend</h1>
        <p className="lead">
          This page works on your friend’s shared WiFi — even before you have internet.
          Log in or create an account, then enter their invite code.
        </p>
      </section>

      <div className="join-tabs" role="tablist">
        <button
          type="button"
          className={mode === 'login' ? 'join-tab active' : 'join-tab'}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'join-tab active' : 'join-tab'}
          onClick={() => setMode('signup')}
        >
          First time
        </button>
      </div>

      {mode === 'login' ? (
        <form className="card-form" onSubmit={onLogin}>
          <FormField
            label="Phone number"
            required
            value={loginForm.phone}
            onChange={(e) => setLoginForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <FormField
            label="Password"
            type="password"
            required
            value={loginForm.password}
            onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
          />
          {error ? <p className="error">{error}</p> : null}
          <Button type="submit" disabled={loading} className="dependant-submit">
            {loading ? 'Signing in…' : 'Continue'}
          </Button>
        </form>
      ) : (
        <form className="card-form" onSubmit={onSignup}>
          <FormField
            label="Full name"
            value={signupForm.full_name}
            onChange={(e) => setSignupForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Optional"
          />
          <FormField
            label="Email"
            type="email"
            required
            value={signupForm.email}
            onChange={(e) => setSignupForm((f) => ({ ...f, email: e.target.value }))}
          />
          <FormField
            label="Phone number"
            required
            value={signupForm.phone}
            onChange={(e) => setSignupForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+2547..."
          />
          <FormField
            label="Password"
            type="password"
            required
            minLength={8}
            value={signupForm.password}
            onChange={(e) => setSignupForm((f) => ({ ...f, password: e.target.value }))}
          />
          {error ? <p className="error">{error}</p> : null}
          <Button type="submit" disabled={loading} className="dependant-submit">
            {loading ? 'Creating…' : 'Create account & continue'}
          </Button>
        </form>
      )}

      <p className="muted join-footnote">
        Bookmark this page. Next time open the same link from your friend — it loads from
        their computer so you can connect without internet first.
      </p>
      <p className="muted">
        Sharing instead? <Link to="/signup">Create a sharing account</Link>
      </p>
    </Shell>
  )
}
