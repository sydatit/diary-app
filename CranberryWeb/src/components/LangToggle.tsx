import { useI18n } from '../i18n'

/** Compact EN/VI switch for screens without Settings (sign in, register). */
export function LangToggle() {
  const { lang, setPref } = useI18n()
  const next = lang === 'vi' ? 'en' : 'vi'
  const label = next === 'vi' ? 'Tiếng Việt' : 'English'
  return (
    <button type="button" className="icon-btn lang-toggle" onClick={() => setPref(next)} aria-label={label} title={label}>
      {next.toUpperCase()}
    </button>
  )
}
