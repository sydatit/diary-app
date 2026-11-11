import { useCallback, useEffect, useState } from 'react'
import { journalsApi } from '../api/journals'
import { useAuth } from '../auth/AuthContext'
import type { Journal } from '../types'
import { sortByDateDesc } from './stats'
import { errorText, useI18n } from '../i18n'

export function useJournals() {
  const { userId } = useAuth()
  const [journals, setJournals] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useI18n()
  const [error, setError] = useState<unknown>(null)

  const reload = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setJournals(sortByDateDesc(await journalsApi.list(userId)))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { journals, loading, error: error ? errorText(error, t, 'error.loadJournal') : null, reload }
}
