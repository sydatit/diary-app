import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  onClose: () => void
  actions?: ReactNode
}

export function Modal({ open, title, children, onClose, actions }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children && <div className="modal-body">{children}</div>}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}
