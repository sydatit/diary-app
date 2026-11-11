import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { useI18n } from '../i18n'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const dark = theme === 'dark'
  const label = t(dark ? 'theme.toLight' : 'theme.toDark')
  return (
    <button type="button" className={`icon-btn theme-toggle ${className}`} onClick={toggle} aria-label={label} title={label}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
