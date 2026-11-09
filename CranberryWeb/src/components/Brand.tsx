export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="8" fill="var(--accent)" />
      <path
        d="M16 9.5v5.5M11.6 12.2a6 6 0 1 0 8.8 0"
        stroke="#fff"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Brand() {
  return (
    <span className="brand">
      <BrandMark />
      <span className="brand-name">Unplug</span>
    </span>
  )
}
