export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 9c0-3 2-5 5-6" stroke="var(--leaf)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M21 3c1.8.4 3 1.6 3.4 3.2-1.8.2-3.2-.6-3.4-3.2Z" fill="var(--leaf)" />
      <circle cx="16" cy="19" r="10" fill="var(--accent)" />
      <circle cx="12.5" cy="15.5" r="2.5" fill="#fff" opacity=".35" />
    </svg>
  )
}

export function Brand() {
  return (
    <span className="brand">
      <BrandMark />
      <span className="brand-name">Cranberry</span>
    </span>
  )
}
