import { levelColor, stressLabel, urgeLabel } from '../lib/stats'
import { useI18n, type TKey } from '../i18n'

interface LevelSliderProps {
  value: number
  onChange: (n: number) => void
  /** Used in aria labels, e.g. "Urge 4". */
  name: TKey
  labelOf: (n: number) => TKey
  ends: [TKey, TKey]
}

/** 1–10 picker coloured from calm (sage) to strong (rose). */
export function LevelSlider({ value, onChange, name, labelOf, ends }: LevelSliderProps) {
  const { t } = useI18n()
  const color = levelColor(value)
  return (
    <div className="urge-slider">
      <div className="urge-head">
        <span className="urge-value" style={{ color }}>
          {value}
          <small>/10</small>
        </span>
        <span className="pill" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          {t(labelOf(value))}
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
            aria-label={`${t(name)} ${n}`}
            aria-pressed={n === value}
          />
        ))}
      </div>
      <div className="urge-ends">
        <span>{t(ends[0])}</span>
        <span>{t(ends[1])}</span>
      </div>
    </div>
  )
}

export function UrgeSlider(props: { value: number; onChange: (n: number) => void }) {
  return <LevelSlider {...props} name="level.urge" labelOf={urgeLabel} ends={['level.urge.min', 'level.urge.max']} />
}

export function StressSlider(props: { value: number; onChange: (n: number) => void }) {
  return <LevelSlider {...props} name="level.stress" labelOf={stressLabel} ends={['level.stress.min', 'level.stress.max']} />
}

export function UrgeDots({ value }: { value: number }) {
  const { t } = useI18n()
  const color = levelColor(value)
  return (
    <span className="urge-dots" title={`${t('level.urge')} ${value}/10 · ${t(urgeLabel(value))}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={i < value ? { background: color } : undefined} />
      ))}
    </span>
  )
}
