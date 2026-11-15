import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings'
import { usersApi } from '../api/users'
import { renderApp, signedIn } from '../test/render'

vi.mock('../api/users', () => ({
  usersApi: { profile: vi.fn(), update: vi.fn(), remove: vi.fn(), signOutEverywhere: vi.fn() },
}))
const api = vi.mocked(usersApi)

describe('Settings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    signedIn()
    api.profile.mockResolvedValue({ userId: 'u1', userName: 'An', email: 'an@example.com', detoxStartDate: '2026-11-01' })
  })

  it('only allows deleting the account after typing the user name', async () => {
    const user = userEvent.setup()
    api.remove.mockResolvedValue(undefined)
    renderApp(<Settings />)

    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    const confirm = screen.getByRole('button', { name: 'Delete forever' })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByRole('textbox'), 'Ann')
    expect(confirm).toBeDisabled()
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'An')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('u1'))
  })

  it('sign out everywhere revokes on the server, then signs out here', async () => {
    const user = userEvent.setup()
    api.signOutEverywhere.mockResolvedValue(undefined)
    renderApp(<Settings />)

    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }))
    await waitFor(() => expect(api.signOutEverywhere).toHaveBeenCalledOnce())
    expect(localStorage.getItem('unplug.token')).toBeNull()
  })
})
