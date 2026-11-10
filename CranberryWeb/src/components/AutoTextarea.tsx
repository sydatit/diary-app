import { useEffect, useId, useRef, type TextareaHTMLAttributes } from 'react'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}

/** Textarea that grows with its content. */
export function AutoTextarea({ label, hint, value, onChange, ...rest }: Props) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <div className="field prompt">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      <textarea id={id} ref={ref} rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  )
}
