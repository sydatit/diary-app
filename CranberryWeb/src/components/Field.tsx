import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../i18n'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  prefix?: string
  suffix?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, prefix, suffix, type, className = '', ...rest },
  ref,
) {
  const id = useId()
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        {prefix && <span className="input-affix">{prefix}</span>}
        <input ref={ref} id={id} type={isPassword && show ? 'text' : type} {...rest} />
        {suffix && <span className="input-affix">{suffix}</span>}
        {isPassword && (
          <button
            type="button"
            className="input-icon-btn"
            onClick={() => setShow((s) => !s)}
            aria-label={t(show ? 'auth.hidePassword' : 'auth.showPassword')}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
})
