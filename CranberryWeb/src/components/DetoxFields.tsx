import type { DetoxSetup } from '../types'
import { Field } from './Field'

interface Props {
  value: DetoxSetup
  onChange: (v: DetoxSetup) => void
}

export function DetoxFields({ value, onChange }: Props) {
  return (
    <Field
      label="Start date"
      type="date"
      required
      value={value.detoxStartDate}
      onChange={(e) => onChange({ ...value, detoxStartDate: e.target.value })}
      hint="The day you start (or started) unplugging."
    />
  )
}
