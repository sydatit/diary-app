import { describe, expect, it } from 'vitest'
import { avgBedtime, bedtimeBand, bedtimeByDate, sleepNow, bedtimeColor, bedtimeLabel, bedtimeToMinutes, isBedtime, minutesToBedtime } from './sleep'

describe('sleep', () => {
  it('files a tap under the day its night closes', () => {
    expect(sleepNow(new Date(2026, 10, 15, 23, 30))).toEqual({ date: '2026-11-15', bedtime: '23:30' })
    expect(sleepNow(new Date(2026, 10, 15, 12, 0))).toEqual({ date: '2026-11-15', bedtime: '12:00' })
    expect(sleepNow(new Date(2026, 10, 16, 0, 5))).toEqual({ date: '2026-11-15', bedtime: '00:05' })
    expect(sleepNow(new Date(2026, 10, 16, 11, 59))).toEqual({ date: '2026-11-15', bedtime: '11:59' })
  })

  it('goes back across a month and a clock change', () => {
    expect(sleepNow(new Date(2026, 11, 1, 1, 15))).toEqual({ date: '2026-11-30', bedtime: '01:15' })
    // US clocks go back on 1 Nov 2026 (tests run in America/New_York).
    expect(sleepNow(new Date(2026, 10, 2, 0, 30))).toEqual({ date: '2026-11-01', bedtime: '00:30' })
  })

  it('indexes valid bedtimes by date', () => {
    const map = bedtimeByDate([
      { date: '2026-11-15', bedtime: '23:30' },
      { date: '2026-11-14', bedtime: 'nope' },
    ])
    expect(map.get('2026-11-15')).toBe('23:30')
    expect(map.has('2026-11-14')).toBe(false)
  })

  it('measures bedtimes from noon so times after midnight sort later', () => {
    expect(bedtimeToMinutes('12:00')).toBe(0)
    expect(bedtimeToMinutes('23:30')).toBe(690)
    expect(bedtimeToMinutes('00:30')).toBe(750)
    expect(bedtimeToMinutes('11:59')).toBe(1439)
  })

  it('rejects anything that is not HH:mm', () => {
    for (const bad of ['', '9:05', '24:00', '23:60', '11pm', null, undefined]) {
      expect(bedtimeToMinutes(bad)).toBeNull()
      expect(isBedtime(bad)).toBe(false)
    }
    expect(isBedtime('07:05')).toBe(true)
  })

  it('converts minutes back to a clock time', () => {
    for (const t of ['12:00', '22:15', '23:59', '00:00', '03:40', '11:59']) {
      expect(minutesToBedtime(bedtimeToMinutes(t)!)).toBe(t)
    }
  })

  it('averages across midnight', () => {
    expect(avgBedtime(['23:30', '00:30'])).toBe('00:00')
    expect(avgBedtime(['22:00', '23:00', '00:00'])).toBe('23:00')
    expect(avgBedtime(['01:00', '02:30'])).toBe('01:45')
  })

  it('skips missing values and returns null when there are none', () => {
    expect(avgBedtime(['23:00', null, undefined, 'nope'])).toBe('23:00')
    expect(avgBedtime([null, undefined])).toBeNull()
    expect(avgBedtime([])).toBeNull()
  })

  it('bands get later with the clock', () => {
    expect(bedtimeBand('21:30')).toBe(1)
    expect(bedtimeBand('22:59')).toBe(1)
    expect(bedtimeBand('23:00')).toBe(2)
    expect(bedtimeBand('23:59')).toBe(2)
    expect(bedtimeBand('00:00')).toBe(3)
    expect(bedtimeBand('01:00')).toBe(4)
    expect(bedtimeBand('02:00')).toBe(5)
    expect(bedtimeBand('05:30')).toBe(5)
  })

  it('labels and colours follow the band', () => {
    expect(bedtimeLabel('22:00')).toBe('sleep.band.1')
    expect(bedtimeLabel('03:00')).toBe('sleep.band.5')
    expect(bedtimeColor('22:00')).toBe('var(--sage)')
    expect(bedtimeColor('00:30')).toBe('var(--amber)')
    expect(bedtimeColor('03:00')).toBe('var(--rose)')
  })
})
