import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, session, setUnauthorizedHandler, tokenExpiry } from '../api/client'
import { usersApi } from '../api/users'
import type { UserProfile } from '../types'

interface AuthState {
  userId: string | null
  profile: UserProfile | null
  loading: boolean
  /** The profile couldn't be loaded for a reason other than an expired session (offline, server down). */
  profileError: boolean
  retryProfile: () => void
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
  const [profileError, setProfileError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const signOut = useCallback(() => {
    session.clear()
    setUserId(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    setProfile(await usersApi.profile())
  }, [])

  const retryProfile = useCallback(() => setAttempt((a) => a + 1), [])

  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  // Signed out (or in as someone else) in another tab: follow it here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== 'unplug.token') return
      if (!session.token) signOut()
      else if (session.userId !== userId) setUserId(validSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [signOut, userId])

  // Load the profile whenever we have a session; auto sign-out when the token expires.
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setProfileError(false)
    usersApi
      .profile()
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch((err) => {
        if (cancelled) return
        // Only an expired/revoked session ends it; offline or a server hiccup keeps the user signed in.
        if (err instanceof ApiError && err.status === 401) signOut()
        else setProfileError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const exp = session.token ? tokenExpiry(session.token) : null
    const delay = exp ? Math.max(0, exp - Date.now()) : null
    // setTimeout overflows above 2^31-1 ms (~24.8 days) and would fire immediately.
    const t = delay !== null && delay <= 2_147_483_647 ? window.setTimeout(signOut, delay) : null
    return () => {
      cancelled = true
      if (t !== null) window.clearTimeout(t)
    }
  }, [userId, signOut, attempt])

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
    () => ({ userId, profile, loading, profileError, retryProfile, signIn, completeSignIn, signOut, refreshProfile }),
    [userId, profile, loading, profileError, retryProfile, signIn, completeSignIn, signOut, refreshProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
