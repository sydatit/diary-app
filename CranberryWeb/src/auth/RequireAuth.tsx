import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullPageSpinner } from '../components/Spinner'
import { Button } from '../components/Button'
import { useI18n } from '../i18n'

export function RequireAuth() {
  const { userId, profile, loading, profileError, retryProfile, signOut } = useAuth()
  const location = useLocation()
  const { t } = useI18n()
  if (!userId) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  if (profileError && !loading) {
    return (
      <div className="full-center">
        <div className="stack" style={{ textAlign: 'center', maxWidth: 320 }}>
          <p>{t('auth.loadFailed')}</p>
          <Button onClick={retryProfile}>{t('common.retry')}</Button>
          <Button variant="secondary" onClick={signOut}>
            {t('common.signOut')}
          </Button>
        </div>
      </div>
    )
  }
  if (loading || !profile) return <FullPageSpinner />
  return <Outlet />
}

export function GuestOnly() {
  const { userId } = useAuth()
  if (userId) return <Navigate to="/" replace />
  return <Outlet />
}
