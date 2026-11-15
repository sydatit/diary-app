import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, normalizeDate, parseDate, startOfDay, toISODate } from './date'

describe('date helpers (America/New_York, with DST)', () => {
  it('really runs in a DST time zone', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(300)
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(240)
  })

  it('formats a local date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('parses YYYY-MM-DD as a local date, not UTC midnight', () => {
    const d = parseDate('2026-03-01')!
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 1, 0])
  })

  it('keeps only the date part of a timestamp string', () => {
    expect(normalizeDate('2026-11-15T22:30:00')).toBe('2026-11-15')
  })

  it('returns null / empty for missing or garbage input', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('not a date')).toBeNull()
    expect(normalizeDate(undefined)).toBe('')
  })

  it('counts calendar days across the spring-forward change (23h day)', () => {
    expect(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9))).toBe(2)
  })

  it('counts calendar days across the fall-back change (25h day)', () => {
    expect(daysBetween(new Date(2026, 9, 31, 23), new Date(2026, 10, 2, 1))).toBe(2)
  })

  it('adds days by calendar, landing on midnight even across DST', () => {
    const d = addDays(new Date(2026, 2, 7, 15), 1)
    expect(toISODate(d)).toBe('2026-03-08')
    expect(d.getHours()).toBe(0)
    expect(toISODate(addDays(new Date(2026, 1, 28), 1))).toBe('2026-03-01')
  })

  it('startOfDay drops the time', () => {
    expect(startOfDay(new Date(2026, 5, 1, 17, 45)).getHours()).toBe(0)
  })
})
