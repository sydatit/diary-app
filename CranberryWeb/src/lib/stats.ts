import type { Journal, UserProfile } from '../types'
import type { TKey } from '../i18n/en'
import { addDays, daysBetween, parseDate, startOfDay, toISODate } from './date'

export interface Stats {
  dayNumber: number
  started: boolean
  avgStress7: number | null
  avgUrge7: number | null
  avgMood7: number | null
  streak: number
  entries7: number
}

export function computeStats(profile: UserProfile, journals: Journal[]): Stats {
  const today = startOfDay(new Date())
  const start = parseDate(profile.detoxStartDate)
  const started = !!start && start <= today
  const dayNumber = start && started ? daysBetween(start, today) + 1 : 0

  const weekAgo = addDays(today, -6)
  const recent = journals.filter((j) => {
    const d = parseDate(j.date)
    return d && d >= weekAgo && d <= today
  })
  // Average over entries that have the value (stress is missing on entries written before it existed).
  const avg = (f: (j: Journal) => number | null) => {
    const vals = recent.map(f).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  // Consecutive days with a reflection, ending today (or yesterday if today isn't written yet).
  const days = new Set(journals.map((j) => normalize(j.date)))
  let streak = 0
  let cursor = days.has(toISODate(today)) ? today : addDays(today, -1)
  while (days.has(toISODate(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }

  return {
    dayNumber,
    started,
    avgStress7: avg((j) => j.stressLevel),
    avgUrge7: avg((j) => j.urgeLevel),
    avgMood7: avg((j) => j.mood),
    streak,
    entries7: recent.length,
  }
}

function normalize(date: string): string {
  const d = parseDate(date)
  return d ? toISODate(d) : ''
}

export function findByDate(journals: Journal[], iso: string): Journal | undefined {
  return journals.find((j) => normalize(j.date) === iso)
}

export interface DayPoint {
  date: Date
  urge: number | null
  stress: number | null
  mood: number | null
}

export function lastNDays(journals: Journal[], n: number): DayPoint[] {
  const today = startOfDay(new Date())
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    const j = findByDate(journals, toISODate(date))
    return j
      ? { date, urge: j.urgeLevel, stress: j.stressLevel ?? null, mood: j.mood }
      : { date, urge: null, stress: null, mood: null }
  })
}

export function sortByDateDesc(journals: Journal[]): Journal[] {
  return [...journals].sort((a, b) => {
    const da = parseDate(a.date)?.getTime() ?? 0
    const db = parseDate(b.date)?.getTime() ?? 0
    return db - da || b.journalId - a.journalId
  })
}

export const MOODS = [
  { value: 1, emoji: '😞', label: 'mood.1' },
  { value: 2, emoji: '😕', label: 'mood.2' },
  { value: 3, emoji: '😐', label: 'mood.3' },
  { value: 4, emoji: '🙂', label: 'mood.4' },
  { value: 5, emoji: '😄', label: 'mood.5' },
] as const satisfies readonly { value: number; emoji: string; label: TKey }[]

export const moodOf = (n: number) => MOODS[Math.min(5, Math.max(1, Math.round(n))) - 1]

/** 1–10 -> band 1..5 (1-2, 3-4, 5-6, 7-8, 9-10). */
const band = (n: number) => Math.min(5, Math.max(1, Math.ceil(n / 2)))

/** Translation key for an urge level. */
export const urgeLabel = (n: number) => `level.urge.${band(n)}` as TKey

/** Translation key for a stress level. */
export const stressLabel = (n: number) => `level.stress.${band(n)}` as TKey

/** Colour for a 1–10 level (urge or stress), from sage (calm) to rose (strong). */
export function levelColor(n: number): string {
  if (n <= 2) return 'var(--sage)'
  if (n <= 4) return 'var(--olive)'
  if (n <= 6) return 'var(--amber)'
  if (n <= 8) return 'var(--coral)'
  return 'var(--rose)'
}

export function firstLine(j: Journal): string {
  return (j.dayReflection || j.win || j.gratitude || j.improvement || '').split('\n')[0]
}
