export function Shell({ children, narrow = false, className = '' }) {
  const classes = ['shell', narrow ? 'narrow' : '', className].filter(Boolean).join(' ')
  return <main className={classes}>{children}</main>
}
