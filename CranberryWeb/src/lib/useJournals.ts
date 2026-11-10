import { useCallback, useEffect, useState } from 'react'
import { journalsApi } from '../api/journals'
import { useAuth } from '../auth/AuthContext'
import type { Journal } from '../types'
import { sortByDateDesc } from './stats'

export function useJournals() {
  const { userId } = useAuth()
  const [journals, setJournals] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setJournals(sortByDateDesc(await journalsApi.list(userId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your journal.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { journals, loading, error, reload }
}
