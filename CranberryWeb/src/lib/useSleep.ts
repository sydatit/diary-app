import { useCallback, useEffect, useState } from 'react'
import { sleepApi } from '../api/sleep'
import { useAuth } from '../auth/AuthContext'
import type { SleepLog } from '../types'

/** The user's bedtime logs, plus the two things the "going to bed" button does to them. */
export function useSleep() {
  const { userId } = useAuth()
  const [sleep, setSleep] = useState<SleepLog[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // Bedtimes only decorate the page, so a failed load just leaves them out.
    sleepApi
      .list(userId)
      .then((list) => {
        if (!cancelled) setSleep(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  const log = useCallback(
    async (date: string, bedtime: string) => {
      if (!userId) return
      await sleepApi.set(userId, date, bedtime)
      setSleep((list) => [{ date, bedtime }, ...list.filter((l) => l.date !== date)])
    },
    [userId],
  )

  const undo = useCallback(
    async (date: string) => {
      if (!userId) return
      await sleepApi.remove(userId, date)
      setSleep((list) => list.filter((l) => l.date !== date))
    },
    [userId],
  )

  return { sleep, log, undo }
}
