import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerifyEmail from './VerifyEmail'
import { ApiError } from '../api/client'
import { usersApi } from '../api/users'
import { renderApp } from '../test/render'

vi.mock('../api/users', () => ({ usersApi: { profile: vi.fn(), verifyEmail: vi.fn(), resendCode: vi.fn() } }))
const api = vi.mocked(usersApi)

describe('VerifyEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.profile.mockReturnValue(new Promise(() => {}))
  })

  it('without an email in the navigation state goes back to sign in', () => {
    renderApp(<VerifyEmail />, { route: '/verify' })
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
  })

  it('pasting the code fills every box and submits it', async () => {
    api.verifyEmail.mockResolvedValue({ token: 'x.e30.y', userId: 'u1' })
    renderApp(<VerifyEmail />, {
      route: '/verify',
      path: '/verify',
      state: { email: 'an@example.com' },
      extraRoutes: <Route path="/" element={<p>home</p>} />,
    })

    const first = screen.getByLabelText('Digit 1')
    fireEvent.paste(first, { clipboardData: { getData: () => 'Code: 123 456' } })

    await waitFor(() => expect(api.verifyEmail).toHaveBeenCalledWith('an@example.com', '123456'))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
  })

  it('shows a translated error for a wrong code and keeps the digits', async () => {
    api.verifyEmail.mockRejectedValue(new ApiError(400, 'bad', { code: 'Invalid' }))
    renderApp(<VerifyEmail />, { route: '/verify', state: { email: 'an@example.com' } })

    fireEvent.paste(screen.getByLabelText('Digit 1'), { clipboardData: { getData: () => '654321' } })

    expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't right")
    expect(screen.getByLabelText('Digit 6')).toHaveValue('1')
  })
})
