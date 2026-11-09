import type { Habits } from '../types'
import { Field } from './Field'
import { toISODate } from '../lib/date'

interface Props {
  value: Habits
  onChange: (h: Habits) => void
}

export function HabitsFields({ value, onChange }: Props) {
  const set = <K extends keyof Habits>(k: K, v: Habits[K]) => onChange({ ...value, [k]: v })
  const num = (s: string) => (s === '' ? 0 : Number(s))
  return (
    <div className="stack">
      <Field
        label="Quit date"
        type="date"
        required
        max={toISODate(new Date(Date.now() + 365 * 86_400_000))}
        value={value.quitDate}
        onChange={(e) => set('quitDate', e.target.value)}
        hint="The day you stopped — or plan to stop — smoking."
      />
      <div className="grid-2">
        <Field
          label="Cigarettes per day"
          type="number"
          min={1}
          required
          value={value.avgSmokedDaily || ''}
          onChange={(e) => set('avgSmokedDaily', num(e.target.value))}
          hint="Before quitting"
        />
        <Field
          label="Cigarettes per pack"
          type="number"
          min={1}
          required
          value={value.cigsPerPack || ''}
          onChange={(e) => set('cigsPerPack', num(e.target.value))}
        />
      </div>
      <Field
        label="Price per pack"
        type="number"
        min={0.01}
        step="0.01"
        prefix="$"
        required
        value={value.pricePerPack || ''}
        onChange={(e) => set('pricePerPack', num(e.target.value))}
      />
    </div>
  )
}
