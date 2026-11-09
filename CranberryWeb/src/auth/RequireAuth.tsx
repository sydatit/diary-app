import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullPageSpinner } from '../components/Spinner'

export function RequireAuth() {
  const { userId, profile, loading } = useAuth()
  const location = useLocation()
  if (!userId) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  if (loading || !profile) return <FullPageSpinner />
  return <Outlet />
}

export function GuestOnly() {
  const { userId } = useAuth()
  if (userId) return <Navigate to="/" replace />
  return <Outlet />
}
