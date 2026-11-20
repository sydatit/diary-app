import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BedtimeButton } from './BedtimeButton'
import { renderApp } from '../test/render'

const at = (y: number, m: number, d: number, h: number, min: number) =>
  vi.useFakeTimers({ now: new Date(y, m - 1, d, h, min), toFake: ['Date'] })

describe('BedtimeButton', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => vi.useRealTimers())

  it('one tap logs the current time as tonight’s bedtime', async () => {
    at(2026, 11, 15, 23, 42)
    const log = vi.fn().mockResolvedValue(undefined)
    renderApp(<BedtimeButton sleep={[]} log={log} undo={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: "I'm going to bed now" }))
    await waitFor(() => expect(log).toHaveBeenCalledWith('2026-11-15', '23:42'))
    expect(await screen.findByText('Bedtime logged: 23:42. Sleep well!')).toBeInTheDocument()
  })

  it('a tap after midnight still belongs to the day before', async () => {
    at(2026, 11, 16, 0, 20)
    const log = vi.fn().mockResolvedValue(undefined)
    renderApp(<BedtimeButton sleep={[]} log={log} undo={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: "I'm going to bed now" }))
    await waitFor(() => expect(log).toHaveBeenCalledWith('2026-11-15', '00:20'))
  })

  it('uses the time of the tap, not of the first render', async () => {
    at(2026, 11, 15, 22, 0)
    const log = vi.fn().mockResolvedValue(undefined)
    renderApp(<BedtimeButton sleep={[]} log={log} undo={vi.fn()} />)

    vi.setSystemTime(new Date(2026, 10, 15, 23, 5))
    fireEvent.click(screen.getByRole('button', { name: "I'm going to bed now" }))
    await waitFor(() => expect(log).toHaveBeenCalledWith('2026-11-15', '23:05'))
  })

  it('shows tonight’s logged time with an undo instead of the button', async () => {
    at(2026, 11, 16, 8, 0) // the next morning: last night is still "tonight" until noon
    const undo = vi.fn().mockResolvedValue(undefined)
    renderApp(<BedtimeButton sleep={[{ date: '2026-11-15', bedtime: '23:42' }]} log={vi.fn()} undo={undo} />)

    expect(screen.getByText('Went to bed at 23:42')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I'm going to bed now" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(undo).toHaveBeenCalledWith('2026-11-15'))
  })

  it('offers the button again for a new night', () => {
    at(2026, 11, 16, 21, 0)
    renderApp(<BedtimeButton sleep={[{ date: '2026-11-15', bedtime: '23:42' }]} log={vi.fn()} undo={vi.fn()} />)
    expect(screen.getByRole('button', { name: "I'm going to bed now" })).toBeInTheDocument()
  })

  it('says so when saving fails and keeps the button', async () => {
    at(2026, 11, 15, 23, 42)
    const log = vi.fn().mockRejectedValue(new Error(''))
    renderApp(<BedtimeButton sleep={[]} log={log} undo={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: "I'm going to bed now" }))
    expect(await screen.findByText("Couldn't save your bedtime. Try again.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I'm going to bed now" })).toBeEnabled()
  })
})
