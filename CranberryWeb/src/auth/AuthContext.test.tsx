import { act, screen, waitFor } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireAuth } from './RequireAuth'
import { ApiError, session } from '../api/client'
import { usersApi } from '../api/users'
import { renderApp, signedIn } from '../test/render'

vi.mock('../api/users', () => ({ usersApi: { profile: vi.fn(), signIn: vi.fn() } }))
const profile = vi.mocked(usersApi.profile)

const PROFILE = { userId: 'u1', userName: 'An', email: 'an@example.com', detoxStartDate: '2026-11-01' }

function renderProtected() {
  return renderApp(<RequireAuth />, {
    route: '/',
    path: '/',
    extraRoutes: <Route path="/signin" element={<p>sign-in page</p>} />,
  })
}

describe('AuthProvider + RequireAuth', () => {
  beforeEach(() => {
    profile.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('sends a signed-out visitor to sign in', () => {
    renderProtected()
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
  })

  it('treats an expired stored token as signed out and clears it', () => {
    signedIn('u1', -60)
    renderProtected()
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
    expect(session.token).toBeNull()
  })

  it('signs out when the profile request says 401', async () => {
    signedIn()
    profile.mockRejectedValue(new ApiError(401, 'expired'))
    renderProtected()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/signin'))
    expect(session.token).toBeNull()
  })

  it('keeps the session when the profile fails for another reason, and can retry (regression)', async () => {
    signedIn()
    profile.mockRejectedValueOnce(new ApiError(0, 'offline', undefined, 'error.network'))
    renderProtected()

    const retry = await screen.findByRole('button', { name: /try again/i })
    expect(session.token).not.toBeNull()
    expect(screen.getByTestId('location')).toHaveTextContent('/')

    profile.mockResolvedValueOnce(PROFILE)
    await act(async () => retry.click())
    await waitFor(() => expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument())
    expect(profile).toHaveBeenCalledTimes(2)
  })

  it('signs out when the token expires while the app is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    signedIn('u1', 5)
    profile.mockResolvedValue(PROFILE)
    renderProtected()
    await waitFor(() => expect(profile).toHaveBeenCalled())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
  })

  it('follows a sign-out in another tab', async () => {
    signedIn()
    profile.mockResolvedValue(PROFILE)
    renderProtected()
    await waitFor(() => expect(profile).toHaveBeenCalled())

    await act(async () => {
      session.clear()
      window.dispatchEvent(new StorageEvent('storage', { key: 'unplug.token', newValue: null }))
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
  })
})
