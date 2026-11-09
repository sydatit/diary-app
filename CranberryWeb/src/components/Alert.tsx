import { AlertCircle } from 'lucide-react'

export function Alert({ children }: { children: string | null }) {
  if (!children) return null
  return (
    <div className="alert" role="alert">
      <AlertCircle size={16} />
      <span>{children}</span>
    </div>
  )
}
