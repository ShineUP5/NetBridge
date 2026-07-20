import { Navigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { ButtonLink } from '../components/ButtonLink'
import { Shell } from '../components/Shell'
import { roleHome, useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user } = useAuth()
  if (user) return <Navigate to={roleHome(user.role)} replace />

  return (
    <Shell>
      <section className="hero-panel">
        <Brand to={null} size="lg" />
        <h1>Share your internet with friends.</h1>
        <p className="lead">
          One person shares. Friends join with a code. Everyone needs an account.
        </p>
        <div className="cta-row">
          <ButtonLink to="/signup">Create account</ButtonLink>
          <ButtonLink to="/login" variant="ghost">
            Log in
          </ButtonLink>
          <ButtonLink to="/join" variant="ghost">
            Join a friend
          </ButtonLink>
        </div>
      </section>
    </Shell>
  )
}
