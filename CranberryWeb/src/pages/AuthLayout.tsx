import type { ReactNode } from 'react'
import { BrandMark } from '../components/Brand'
import { ThemeToggle } from '../components/ThemeToggle'
import { LangToggle } from '../components/LangToggle'
import { useI18n } from '../i18n'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="auth">
      <div className="auth-aside">
        <div className="auth-aside-inner">
          <BrandMark size={40} />
          <blockquote>{t('auth.quote')}</blockquote>
          <p>{t('auth.pitch')}</p>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-theme">
          <LangToggle />
          <ThemeToggle />
        </div>
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
