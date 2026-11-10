import { api } from './client'
import type { Journal, JournalInput, Wrapped } from '../types'

const base = (userId: string) => `/api/users/${userId}/journals`

export const journalsApi = {
  list: async (userId: string) => (await api<Wrapped<Journal[]>>(base(userId))).data ?? [],
  get: async (userId: string, id: number) => (await api<Wrapped<Journal>>(`${base(userId)}/${id}`)).data,
  create: async (userId: string, input: JournalInput) =>
    (await api<Wrapped<Journal>>(base(userId), { method: 'POST', body: input })).data,
  update: (userId: string, id: number, input: JournalInput) =>
    api(`${base(userId)}/${id}`, { method: 'PUT', body: input }),
  remove: (userId: string, id: number) => api(`${base(userId)}/${id}`, { method: 'DELETE' }),
}
