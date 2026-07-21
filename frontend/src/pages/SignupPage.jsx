import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { wakeApi } from '../api/client'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { RolePicker } from '../components/RolePicker'
import { Shell } from '../components/Shell'
import { roleHome, useAuth } from '../context/AuthContext'
import { buildLocalGatewayUrl, isPublicHostedSite, redirectToLocalGateway } from '../utils/localGateway'

const INITIAL = {
  role: 'gateway',
  full_name: '',
  email: '',
  phone: '',
  password: '',
}

export default function SignupPage() {
  const { signup, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [waitHint, setWaitHint] = useState('')

  useEffect(() => {
    wakeApi()
  }, [])

  useEffect(() => {
    if (user?.role === 'gateway' && isPublicHostedSite()) {
      redirectToLocalGateway()
    }
  }, [user])

  useEffect(() => {
    if (!loading) {
      setWaitHint('')
      return undefined
    }
    const t1 = setTimeout(() => setWaitHint('Waking the server… usually under 25 seconds.'), 4000)
    const t2 = setTimeout(() => setWaitHint('Still waiting… will stop at 25s so you can retry.'), 12000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [loading])

  if (user) {
    if (user.role === 'gateway' && isPublicHostedSite()) {
      return (
        <Shell narrow>
          <p className="lead">Opening SERVER dashboard on this PC…</p>
        </Shell>
      )
    }
    return <Navigate to={roleHome(user.role)} replace />
  }

  function setField(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signup(form)
      if (data.user.role === 'gateway' && isPublicHostedSite()) {
        redirectToLocalGateway(data)
        return
      }
      navigate(roleHome(data.user.role))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell narrow>
      <form className="card-form" onSubmit={onSubmit}>
        <Brand />
        <h1>Sign up</h1>
        <p className="lead">Choose SERVER or DEPENDENT.</p>

        <RolePicker
          value={form.role}
          onChange={(role) => setForm((prev) => ({ ...prev, role }))}
        />

        <FormField
          label="Full name"
          value={form.full_name}
          onChange={setField('full_name')}
          placeholder="Optional"
        />
        <FormField
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={setField('email')}
        />
        <FormField
          label="Phone number"
          required
          value={form.phone}
          onChange={setField('phone')}
          placeholder="+2547..."
        />
        <FormField
          label="Password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={setField('password')}
        />

        {waitHint && loading ? <p className="info banner">{waitHint}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating…' : error ? 'Try again' : 'Create account'}
        </Button>
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </Shell>
  )
}
