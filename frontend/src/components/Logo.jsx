export function Logo({ className = '', size = 40, title = 'NetBridge' }) {
  const gradId = `nb-grad-${size}`
  return (
    <svg
      className={`app-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="8" y1="14" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3AD67F" />
          <stop offset="1" stopColor="#2FBF71" />
        </linearGradient>
      </defs>
      <path
        d="M10 26.5c12.2-12 31.8-12 44 0"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M18.5 35c7.5-7.4 19.5-7.4 27 0"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M27 43.5c2.8-2.7 7.2-2.7 10 0"
        stroke="#E8F56B"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="52" r="5" fill="#E8F56B" />
    </svg>
  )
}
