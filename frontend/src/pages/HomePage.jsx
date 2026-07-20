import { Link, Navigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { ButtonLink } from '../components/ButtonLink'
import { Logo } from '../components/Logo'
import { PageLoader } from '../components/PageLoader'
import { roleHome, useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user, booting } = useAuth()
  if (booting) return <PageLoader />
  if (user) return <Navigate to={roleHome(user.role)} replace />

  return (
    <main className="cover">
      <div className="cover-glow" aria-hidden="true" />
      <div className="cover-grid" aria-hidden="true" />

      <section className="cover-stage">
        <div className="cover-logo-orbit" aria-hidden="true">
          <span className="cover-ring cover-ring-a" />
          <span className="cover-ring cover-ring-b" />
          <span className="cover-ring cover-ring-c" />
          <div className="cover-logo-core">
            <Logo size={96} />
          </div>
        </div>

        <Brand to={null} size="lg" className="cover-brand" />

        <h1 className="cover-title">Share your internet with friends.</h1>
        <p className="cover-lead">
          One person shares. Friends join with a code. Real connection through your PC.
        </p>

        <div className="cover-cta">
          <ButtonLink to="/signup">Create account</ButtonLink>
          <ButtonLink to="/login" variant="ghost">
            Log in
          </ButtonLink>
        </div>
        <p className="cover-join">
          Already near a friend? <Link to="/join">Join on their WiFi</Link>
        </p>
      </section>
    </main>
  )
}
