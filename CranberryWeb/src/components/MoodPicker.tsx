import { MOODS } from '../lib/stats'
import { useI18n } from '../i18n'

export function MoodPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useI18n()
  return (
    <div className="mood-picker" role="radiogroup" aria-label={t('mood.aria')}>
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
          <span className="mood-label">{t(m.label)}</span>
        </button>
      ))}
    </div>
  )
}
