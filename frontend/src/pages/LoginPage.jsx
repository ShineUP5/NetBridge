import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { FormField } from '../components/FormField'
import { Shell } from '../components/Shell'
import { roleHome, useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={roleHome(user.role)} replace />

  function setField(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(form)
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
        <h1>Log in</h1>
        <p className="lead">Phone number and password.</p>

        <FormField
          label="Phone number"
          required
          value={form.phone}
          onChange={setField('phone')}
        />
        <FormField
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={setField('password')}
        />

        {error ? <p className="error">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Log in'}
        </Button>
        <p className="muted">
          New here? <Link to="/signup">Create account</Link>
        </p>
      </form>
    </Shell>
  )
}
