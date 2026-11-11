import { useEffect, useId, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  /** Rendered inside the box, bottom-right (e.g. the voice recorder). */
  addon?: ReactNode
}

/** Textarea that grows with its content. */
export function AutoTextarea({ label, hint, value, onChange, addon, ...rest }: Props) {
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
      <div className={`textarea-wrap${addon ? ' has-addon' : ''}`}>
        <textarea id={id} ref={ref} rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
        {addon && <div className="textarea-addon">{addon}</div>}
      </div>
    </div>
  )
}
