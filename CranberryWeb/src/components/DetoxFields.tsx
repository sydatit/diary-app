import type { DetoxSetup } from '../types'
import { Field } from './Field'
import { useI18n } from '../i18n'

interface Props {
  value: DetoxSetup
  onChange: (v: DetoxSetup) => void
}

export function DetoxFields({ value, onChange }: Props) {
  const { t } = useI18n()
  return (
    <Field
      label={t('detox.startDate')}
      type="date"
      required
      value={value.detoxStartDate}
      onChange={(e) => onChange({ ...value, detoxStartDate: e.target.value })}
      hint={t('detox.startDateHint')}
    />
  )
}
