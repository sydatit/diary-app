import type { ReactNode } from 'react'
import { BrandMark } from '../components/Brand'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-aside">
        <div className="auth-aside-inner">
          <BrandMark size={40} />
          <blockquote>
            “Every day without a cigarette is a small, quiet victory. Write it down.”
          </blockquote>
          <p>Cranberry is a calm place to track cravings, celebrate progress and see how far you've come.</p>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <div className="auth-logo">
            <BrandMark size={36} />
          </div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </div>
    </div>
  )
}
