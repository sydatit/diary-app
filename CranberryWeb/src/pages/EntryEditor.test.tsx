import { act, screen, waitFor } from '@testing-library/react'
import { Link, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EntryEditor from './EntryEditor'
import { journalsApi } from '../api/journals'
import { usersApi } from '../api/users'
import { toISODate } from '../lib/date'
import { renderApp, signedIn } from '../test/render'
import type { Journal } from '../types'

vi.mock('../api/users', () => ({ usersApi: { profile: vi.fn() } }))
vi.mock('../api/journals', () => ({ journalsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } }))

// The recorder needs a microphone; a stub lets tests report "busy" like a recording in progress.
let reportBusy: ((busy: boolean) => void) | null = null
vi.mock('../components/VoiceRecorder', () => ({
  VoiceRecorder: (props: { section: string; onBusyChange?: (b: boolean) => void }) => {
    if (props.section === 'reflection') reportBusy = props.onBusyChange ?? null
    return null
  },
}))

const journals = vi.mocked(journalsApi)

const entry = (id: number, date: string): Journal => ({
  journalId: id,
  date,
  mood: 4,
  urgeLevel: 3,
  pickups: 0,
  stressLevel: 2,
  dayReflection: 'Good day',
  gratitude: null,
  win: null,
  improvement: null,
  userId: 'u1',
})

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('EntryEditor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    reportBusy = null
    signedIn()
    vi.mocked(usersApi.profile).mockResolvedValue({ userId: 'u1', userName: 'An', email: 'a@x.com', detoxStartDate: null })
  })
  afterEach(() => vi.useRealTimers())

  it("opens today's entry instead of starting a second one", async () => {
    journals.list.mockResolvedValue([entry(7, toISODate())])
    journals.get.mockResolvedValue(entry(7, toISODate()))
    renderApp(<EntryEditor />, {
      route: '/journal/new',
      path: '/journal/new',
      extraRoutes: <Route path="/journal/:id" element={<p>editing</p>} />,
    })
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/journal/7'))
  })

  it('does not pull the user back after they navigated away (regression)', async () => {
    const list = deferred<Journal[]>()
    journals.list.mockReturnValue(list.promise)
    renderApp(
      <>
        <EntryEditor />
        <Link to="/settings">go to settings</Link>
      </>,
      {
        route: '/journal/new',
        path: '/journal/new',
        extraRoutes: (
          <>
            <Route path="/settings" element={<p>settings page</p>} />
            <Route path="/journal/:id" element={<p>editing</p>} />
          </>
        ),
      },
    )

    // The user leaves before the list arrives; then the list says today's entry exists.
    await act(async () => screen.getByText('go to settings').click())
    expect(screen.getByTestId('location')).toHaveTextContent('/settings')
    await act(async () => list.resolve([entry(7, toISODate())]))

    expect(screen.getByTestId('location')).toHaveTextContent('/settings')
  })

  it('loads an existing entry into the form', async () => {
    journals.get.mockResolvedValue(entry(3, '2026-11-10'))
    renderApp(<EntryEditor />, { route: '/journal/3', path: '/journal/:id' })
    expect(await screen.findByDisplayValue('Good day')).toBeInTheDocument()
    expect(journals.get).toHaveBeenCalledWith('u1', 3)
  })

  it('cannot be saved while a recording is in progress (regression)', async () => {
    journals.list.mockResolvedValue([])
    renderApp(<EntryEditor />, { route: '/journal/new', path: '/journal/new' })
    const save = await screen.findByRole('button', { name: 'Save reflection' })
    expect(save).toBeEnabled()

    await act(async () => reportBusy?.(true))
    expect(save).toBeDisabled()
    await act(async () => reportBusy?.(false))
    expect(save).toBeEnabled()
  })
})
