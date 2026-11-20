import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeStats, findByDate, lastNDays, levelColor, moodOf, sortByDateDesc, stressLabel, urgeLabel } from './stats'
import type { Journal, UserProfile } from '../types'

let nextId = 1
const j = (date: string, extra: Partial<Journal> = {}): Journal => ({
  journalId: nextId++,
  date,
  mood: 3,
  urgeLevel: 5,
  pickups: 0,
  stressLevel: 4,
  bedtime: null,
  dayReflection: null,
  gratitude: null,
  win: null,
  improvement: null,
  userId: 'u1',
  ...extra,
})
const profile = (detoxStartDate: string | null): UserProfile => ({ userId: 'u1', userName: 'An', email: 'a@x.com', detoxStartDate })

describe('stats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 15, 9, 0)) // Sun 15 Nov 2026, 9am local
  })
  afterEach(() => vi.useRealTimers())

  it('day number counts the start date as day 1', () => {
    expect(computeStats(profile('2026-11-15'), []).dayNumber).toBe(1)
    expect(computeStats(profile('2026-11-01'), []).dayNumber).toBe(15)
  })

  it('a start date in the future has not started', () => {
    const s = computeStats(profile('2026-11-20'), [])
    expect(s.started).toBe(false)
    expect(s.dayNumber).toBe(0)
  })

  it('no start date is day 0', () => {
    expect(computeStats(profile(null), []).dayNumber).toBe(0)
  })

  it('streak runs back from today', () => {
    const s = computeStats(profile('2026-11-01'), [j('2026-11-15'), j('2026-11-14'), j('2026-11-13'), j('2026-11-11')])
    expect(s.streak).toBe(3)
  })

  it('streak still counts from yesterday when today is not written yet', () => {
    const s = computeStats(profile('2026-11-01'), [j('2026-11-14'), j('2026-11-13')])
    expect(s.streak).toBe(2)
  })

  it('a gap before yesterday breaks the streak', () => {
    expect(computeStats(profile('2026-11-01'), [j('2026-11-13')]).streak).toBe(0)
  })

  it('7-day averages use today and the 6 days before, skipping missing stress', () => {
    const s = computeStats(profile('2026-11-01'), [
      j('2026-11-15', { mood: 5, urgeLevel: 2, stressLevel: 2 }),
      j('2026-11-09', { mood: 1, urgeLevel: 8, stressLevel: null }),
      j('2026-11-08', { mood: 1, urgeLevel: 10, stressLevel: 10 }), // 7 days ago: outside
    ])
    expect(s.entries7).toBe(2)
    expect(s.avgMood7).toBe(3)
    expect(s.avgUrge7).toBe(5)
    expect(s.avgStress7).toBe(2)
  })

  it('averages are null with no recent entries', () => {
    expect(computeStats(profile('2026-11-01'), []).avgMood7).toBeNull()
    expect(computeStats(profile('2026-11-01'), []).avgBedtime7).toBeNull()
  })

  it('7-day average bedtime crosses midnight and skips entries without one', () => {
    const s = computeStats(profile('2026-11-01'), [
      j('2026-11-15', { bedtime: '23:30' }),
      j('2026-11-14', { bedtime: '00:30' }),
      j('2026-11-13'),
      j('2026-11-08', { bedtime: '04:00' }), // 7 days ago: outside
    ])
    expect(s.avgBedtime7).toBe('00:00')
    expect(computeStats(profile('2026-11-01'), [j('2026-11-15')]).avgBedtime7).toBeNull()
  })

  it('lastNDays carries the bedtime of each day', () => {
    const days = lastNDays([j('2026-11-15', { bedtime: '23:10' }), j('2026-11-14')], 3)
    expect(days.map((d) => d.bedtime)).toEqual([null, null, '23:10'])
  })

  it('lastNDays ends today and fills gaps with nulls', () => {
    const days = lastNDays([j('2026-11-15', { urgeLevel: 7 }), j('2026-11-13')], 3)
    expect(days.map((d) => d.date.getDate())).toEqual([13, 14, 15])
    expect(days.map((d) => d.urge)).toEqual([5, null, 7])
  })

  it('findByDate matches on the calendar day', () => {
    const e = j('2026-11-15T00:00:00')
    expect(findByDate([e], '2026-11-15')).toBe(e)
    expect(findByDate([e], '2026-11-14')).toBeUndefined()
  })

  it('sorts newest first, newest id first on the same day', () => {
    const a = j('2026-11-10')
    const b = j('2026-11-12')
    const c = j('2026-11-12')
    expect(sortByDateDesc([a, b, c]).map((x) => x.journalId)).toEqual([c.journalId, b.journalId, a.journalId])
  })

  it('maps levels to bands, labels and colours', () => {
    expect(moodOf(0).value).toBe(1)
    expect(moodOf(4.6).value).toBe(5)
    expect(urgeLabel(1)).toBe('level.urge.1')
    expect(urgeLabel(10)).toBe('level.urge.5')
    expect(stressLabel(5)).toBe('level.stress.3')
    expect(levelColor(2)).toBe('var(--sage)')
    expect(levelColor(9)).toBe('var(--rose)')
  })
})
