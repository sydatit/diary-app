import type { ReactNode } from 'react'
import { BrandMark } from '../components/Brand'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-aside">
        <div className="auth-aside-inner">
          <BrandMark size={40} />
          <blockquote>
            “Put the phone down. Pick your life up.”
          </blockquote>
          <p>Unplug is a quiet daily journal for loosening your phone's grip — notice the urge, reflect on your day, and watch the pickups fall.</p>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <div className="auth-logo">
            <BrandMark size={36} />
          </div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </div>
    </div>
  )
}
