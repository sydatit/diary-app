import { useI18n } from '../i18n'

export function Spinner({ size = 18 }: { size?: number }) {
  const { t } = useI18n()
  return <span className="spinner" style={{ width: size, height: size }} aria-label={t('common.loading')} />
}

export function FullPageSpinner() {
  return (
    <div className="full-center">
      <Spinner size={28} />
    </div>
  )
}
