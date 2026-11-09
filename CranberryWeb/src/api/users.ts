import { api } from './client'
import type { AuthResult, DetoxSetup, RegisterInput, UserProfile } from '../types'

export const usersApi = {
  register: (input: RegisterInput) =>
    api<{ status: string; message: string; email: string }>('/api/users/register', { method: 'POST', body: input }),
  verifyEmail: (email: string, code: string) =>
    api<AuthResult>('/api/users/verify-email', { method: 'POST', body: { email, code } }),
  resendCode: (email: string) => api<{ message: string }>('/api/users/resend-code', { method: 'POST', body: { email } }),
  signIn: (email: string, password: string) =>
    api<AuthResult>('/api/users/signin', { method: 'POST', body: { email, password } }),
  profile: () => api<UserProfile>('/api/users/profile'),
  update: (id: string, setup: DetoxSetup) => api(`/api/users/${id}`, { method: 'PUT', body: setup }),
  remove: (id: string) => api(`/api/users/${id}`, { method: 'DELETE' }),
}
