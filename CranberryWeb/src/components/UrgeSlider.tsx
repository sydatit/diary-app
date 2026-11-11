import { levelColor, stressLabel, urgeLabel } from '../lib/stats'

interface LevelSliderProps {
  value: number
  onChange: (n: number) => void
  /** Used in aria labels, e.g. "Urge 4". */
  name: string
  labelOf: (n: number) => string
  ends: [string, string]
}

/** 1–10 picker coloured from calm (sage) to strong (rose). */
export function LevelSlider({ value, onChange, name, labelOf, ends }: LevelSliderProps) {
  const color = levelColor(value)
  return (
    <div className="urge-slider">
      <div className="urge-head">
        <span className="urge-value" style={{ color }}>
          {value}
          <small>/10</small>
        </span>
        <span className="pill" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          {labelOf(value)}
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
            aria-label={`${name} ${n}`}
            aria-pressed={n === value}
          />
        ))}
      </div>
      <div className="urge-ends">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  )
}

export function UrgeSlider(props: { value: number; onChange: (n: number) => void }) {
  return <LevelSlider {...props} name="Urge" labelOf={urgeLabel} ends={['No pull', 'Constant pull']} />
}

export function StressSlider(props: { value: number; onChange: (n: number) => void }) {
  return <LevelSlider {...props} name="Stress" labelOf={stressLabel} ends={['Calm', 'Overwhelmed']} />
}

export function UrgeDots({ value }: { value: number }) {
  const color = levelColor(value)
  return (
    <span className="urge-dots" title={`Urge ${value}/10 · ${urgeLabel(value)}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={i < value ? { background: color } : undefined} />
      ))}
    </span>
  )
}
