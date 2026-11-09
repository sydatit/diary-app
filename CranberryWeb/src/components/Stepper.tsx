import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  label?: string
}

export function Stepper({ value, onChange, min = 0, max = 200, label }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min} aria-label="Decrease">
        <Minus size={16} />
      </button>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 0)}
        aria-label={label}
      />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label="Increase">
        <Plus size={16} />
      </button>
    </div>
  )
}
