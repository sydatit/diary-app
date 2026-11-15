import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignIn from './SignIn'
import { ApiError } from '../api/client'
import { usersApi } from '../api/users'
import { renderApp } from '../test/render'

vi.mock('../api/users', () => ({ usersApi: { profile: vi.fn(), signIn: vi.fn(), resendCode: vi.fn() } }))
const api = vi.mocked(usersApi)

async function submit(email = 'an@example.com', password = 'Passw0rd!') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

describe('SignIn', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.profile.mockReturnValue(new Promise(() => {}))
  })

  it('signs in and goes to the page the user came from', async () => {
    api.signIn.mockResolvedValue({ token: 'x.e30.y', userId: 'u1' })
    renderApp(<SignIn />, { route: '/signin', state: { from: '/journal' } })
    await submit()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/journal'))
    expect(api.signIn).toHaveBeenCalledWith('an@example.com', 'Passw0rd!')
  })

  it('shows a friendly message for a wrong password', async () => {
    api.signIn.mockRejectedValue(new ApiError(400, 'Unable to sign in.'))
    renderApp(<SignIn />, { route: '/signin' })
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/i)
  })

  it('sends an unverified account to the verify page with a fresh code', async () => {
    api.signIn.mockRejectedValue(new ApiError(403, 'verify', { code: 'EmailNotConfirmed' }))
    api.resendCode.mockResolvedValue({ message: 'ok' })
    renderApp(<SignIn />, { route: '/signin', extraRoutes: <Route path="/verify" element={<p>verify</p>} /> })
    await submit()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/verify'))
    expect(api.resendCode).toHaveBeenCalledWith('an@example.com')
  })

  it('explains a temporary lockout', async () => {
    api.signIn.mockRejectedValue(new ApiError(429, 'Too many failed sign-in attempts.', { code: 'LockedOut', retryAfter: 300 }))
    renderApp(<SignIn />, { route: '/signin' })
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many failed sign-in attempts/i)
  })
})
