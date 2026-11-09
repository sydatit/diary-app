import { MOODS } from '../lib/stats'

export function MoodPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="mood-picker" role="radiogroup" aria-label="Mood">
      {MOODS.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          className={`mood ${value === m.value ? 'active' : ''}`}
          onClick={() => onChange(m.value)}
        >
          <span className="mood-emoji">{m.emoji}</span>
          <span className="mood-label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
