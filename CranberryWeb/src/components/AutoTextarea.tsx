import { useEffect, useId, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  /** Rendered inside the box, bottom-right (e.g. the voice recorder). */
  addon?: ReactNode
  /** Words being heard right now: shown faded after the text, and the box can't be edited meanwhile. */
  live?: string
}

/** Textarea that grows with its content. */
export function AutoTextarea({ label, hint, value, onChange, addon, live, ...rest }: Props) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value, live])
  return (
    <div className="field prompt">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      <div className={`textarea-wrap${addon ? ' has-addon' : ''}`}>
        {live !== undefined ? (
          // A textarea can't style part of its text, so show a look-alike box while listening.
          <div id={id} className="textarea-live" role="textbox" aria-readonly aria-live="polite">
            {value.replace(/\s+$/, '')}
            {value.trim() && '\n'}
            <span className="live-text">{live}</span>
            <span className="live-caret" aria-hidden />
          </div>
        ) : (
          <textarea id={id} ref={ref} rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
        )}
        {addon && <div className="textarea-addon">{addon}</div>}
      </div>
    </div>
  )
}
