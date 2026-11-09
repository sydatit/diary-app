import { urgeColor, urgeLabel } from '../lib/stats'

export function UrgeSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const color = urgeColor(value)
  return (
    <div className="urge-slider">
      <div className="urge-head">
        <span className="urge-value" style={{ color }}>
          {value}
          <small>/10</small>
        </span>
        <span className="pill" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          {urgeLabel(value)}
        </span>
      </div>
      <div className="urge-scale">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="urge-step"
            style={n <= value ? { background: color } : undefined}
            onClick={() => onChange(n)}
            aria-label={`Urge ${n}`}
            aria-pressed={n === value}
          />
        ))}
      </div>
      <div className="urge-ends">
        <span>No pull</span>
        <span>Constant pull</span>
      </div>
    </div>
  )
}

export function UrgeDots({ value }: { value: number }) {
  const color = urgeColor(value)
  return (
    <span className="urge-dots" title={`Urge ${value}/10 · ${urgeLabel(value)}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={i < value ? { background: color } : undefined} />
      ))}
    </span>
  )
}
