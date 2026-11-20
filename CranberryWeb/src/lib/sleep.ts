import type { TKey } from '../i18n/en'

// Bedtimes are stored as "HH:mm" (24h). To compare and average times that straddle midnight they are
// measured in minutes from noon, so 23:30 -> 690 and 00:30 -> 750 (rather than 1410 and 30).
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
const DAY = 24 * 60
const NOON = 12 * 60

export function isBedtime(value: string | null | undefined): value is string {
  return !!value && HHMM.test(value)
}

/** Minutes after noon (0..1439), or null when the value isn't a valid "HH:mm". */
export function bedtimeToMinutes(value: string | null | undefined): number | null {
  const m = value ? HHMM.exec(value) : null
  if (!m) return null
  return (Number(m[1]) * 60 + Number(m[2]) - NOON + DAY) % DAY
}

/** Inverse of bedtimeToMinutes. */
export function minutesToBedtime(minutes: number): string {
  const clock = (((Math.round(minutes) + NOON) % DAY) + DAY) % DAY
  return `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`
}

/** Average bedtime of the given values, ignoring missing/invalid ones; null when none are usable. */
export function avgBedtime(values: (string | null | undefined)[]): string | null {
  const mins = values.map(bedtimeToMinutes).filter((v): v is number => v != null)
  return mins.length ? minutesToBedtime(mins.reduce((s, v) => s + v, 0) / mins.length) : null
}

/** 1 = before 23:00, 2 = 23:xx, 3 = 00:xx, 4 = 01:xx, 5 = 02:00 or later. */
export function bedtimeBand(value: string): 1 | 2 | 3 | 4 | 5 {
  const m = bedtimeToMinutes(value) ?? 0
  if (m < 11 * 60) return 1
  if (m < 12 * 60) return 2
  if (m < 13 * 60) return 3
  if (m < 14 * 60) return 4
  return 5
}

/** Translation key describing how late a bedtime is. */
export const bedtimeLabel = (value: string) => `sleep.band.${bedtimeBand(value)}` as TKey

const COLORS = ['var(--sage)', 'var(--olive)', 'var(--amber)', 'var(--coral)', 'var(--rose)']

/** Colour for a bedtime, from sage (early) to rose (very late). */
export const bedtimeColor = (value: string) => COLORS[bedtimeBand(value) - 1]
