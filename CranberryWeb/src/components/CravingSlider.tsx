import { cravingColor, cravingLabel } from '../lib/stats'

export function CravingSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const color = cravingColor(value)
  return (
    <div className="craving-slider">
      <div className="craving-head">
        <span className="craving-value" style={{ color }}>
          {value}
          <small>/10</small>
        </span>
        <span className="pill" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          {cravingLabel(value)}
        </span>
      </div>
      <div className="craving-scale">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`craving-step ${n <= value ? 'on' : ''}`}
            style={n <= value ? { background: color } : undefined}
            onClick={() => onChange(n)}
            aria-label={`Craving ${n}`}
            aria-pressed={n === value}
          />
        ))}
      </div>
      <div className="craving-ends">
        <span>Calm</span>
        <span>Intense</span>
      </div>
    </div>
  )
}

export function CravingDots({ value }: { value: number }) {
  const color = cravingColor(value)
  return (
    <span className="craving-dots" title={`Craving ${value}/10 · ${cravingLabel(value)}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={i < value ? { background: color } : undefined} />
      ))}
    </span>
  )
}
