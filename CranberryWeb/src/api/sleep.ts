import { api } from './client'
import type { SleepLog, Wrapped } from '../types'

const base = (userId: string) => `/api/users/${userId}/sleep`

export const sleepApi = {
  list: async (userId: string) => (await api<Wrapped<SleepLog[]>>(base(userId))).data ?? [],
  /** Record (or replace) the bedtime of the night that closes `date`. */
  set: async (userId: string, date: string, bedtime: string) =>
    (await api<Wrapped<SleepLog>>(`${base(userId)}/${date}`, { method: 'PUT', body: { bedtime } })).data,
  remove: (userId: string, date: string) => api(`${base(userId)}/${date}`, { method: 'DELETE' }),
}
