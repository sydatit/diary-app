import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { session, setUnauthorizedHandler, tokenExpiry } from '../api/client'
import { usersApi } from '../api/users'
import type { UserProfile } from '../types'

interface AuthState {
  userId: string | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Store a session obtained elsewhere (e.g. after email verification). */
  completeSignIn: (token: string, userId: string) => void
  signOut: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function validSession(): string | null {
  const token = session.token
  const userId = session.userId
  if (!token || !userId) return null
  const exp = tokenExpiry(token)
  if (exp && exp < Date.now()) {
    session.clear()
    return null
  }
  return userId
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(validSession)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(!!userId)

  const signOut = useCallback(() => {
    session.clear()
    setUserId(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    setProfile(await usersApi.profile())
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  // Load the profile whenever we have a session; auto sign-out when the token expires.
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    usersApi
      .profile()
      .then(setProfile)
      .catch(() => signOut())
      .finally(() => setLoading(false))

    const exp = session.token ? tokenExpiry(session.token) : null
    if (!exp) return
    const t = window.setTimeout(signOut, Math.max(0, exp - Date.now()))
    return () => window.clearTimeout(t)
  }, [userId, signOut])

  const completeSignIn = useCallback((token: string, id: string) => {
    session.save(token, id)
    setUserId(id)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await usersApi.signIn(email, password)
      completeSignIn(res.token, res.userId)
    },
    [completeSignIn],
  )

  const value = useMemo(
    () => ({ userId, profile, loading, signIn, completeSignIn, signOut, refreshProfile }),
    [userId, profile, loading, signIn, completeSignIn, signOut, refreshProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
