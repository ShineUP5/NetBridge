import { Brand } from './Brand'

export function PageLoader() {
  return (
    <main className="shell">
      <div className="page-loader">
        <Brand to={null} size="md" />
        <p className="lead">Loading…</p>
      </div>
    </main>
  )
}
