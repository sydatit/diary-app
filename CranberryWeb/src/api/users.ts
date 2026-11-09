import { api } from './client'
import type { Habits, RegisterInput, UserProfile } from '../types'

export const usersApi = {
  register: (input: RegisterInput) =>
    api<{ status: string; message: string }>('/api/users/register', { method: 'POST', body: input }),
  signIn: (email: string, password: string) =>
    api<{ token: string; userId: string }>('/api/users/signin', { method: 'POST', body: { email, password } }),
  profile: () => api<UserProfile>('/api/users/profile'),
  update: (id: string, habits: Habits) => api(`/api/users/${id}`, { method: 'PUT', body: habits }),
  remove: (id: string) => api(`/api/users/${id}`, { method: 'DELETE' }),
}
