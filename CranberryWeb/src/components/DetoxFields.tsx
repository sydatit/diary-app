import type { DetoxSetup } from '../types'
import { Field } from './Field'

interface Props {
  value: DetoxSetup
  onChange: (v: DetoxSetup) => void
}

export function DetoxFields({ value, onChange }: Props) {
  const set = <K extends keyof DetoxSetup>(k: K, v: DetoxSetup[K]) => onChange({ ...value, [k]: v })
  const num = (s: string) => (s === '' ? 0 : Math.max(0, Math.floor(Number(s))))
  return (
    <div className="stack">
      <Field
        label="Start date"
        type="date"
        required
        value={value.detoxStartDate}
        onChange={(e) => set('detoxStartDate', e.target.value)}
        hint="The day you start (or started) unplugging."
      />
      <div className="grid-2">
        <Field
          label="Pickups per day now"
          type="number"
          min={1}
          required
          value={value.baselinePickups || ''}
          onChange={(e) => set('baselinePickups', num(e.target.value))}
          hint="Check Screen Time / Digital Wellbeing"
        />
        <Field
          label="Daily pickup goal"
          type="number"
          min={1}
          required
          value={value.dailyPickupGoal || ''}
          onChange={(e) => set('dailyPickupGoal', num(e.target.value))}
          hint="Where you want to get to"
        />
      </div>
    </div>
  )
}
