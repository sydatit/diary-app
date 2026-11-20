import { describe, expect, it } from 'vitest'
import { avgBedtime, bedtimeBand, bedtimeColor, bedtimeLabel, bedtimeToMinutes, isBedtime, minutesToBedtime } from './sleep'

describe('sleep', () => {
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
