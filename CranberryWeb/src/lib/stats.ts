import type { Journal, UserProfile } from '../types'
import { addDays, daysBetween, parseDate, startOfDay, toISODate } from './date'

export interface Stats {
  dayNumber: number
  started: boolean
  avgPickups7: number | null
  pickupsAvoided: number
  avgUrge7: number | null
  avgMood7: number | null
  streak: number
  goalDays7: number
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
  const avg = (f: (j: Journal) => number) => (recent.length ? recent.reduce((s, j) => s + f(j), 0) / recent.length : null)

  const baseline = profile.baselinePickups || 0
  const pickupsAvoided = journals.reduce((s, j) => {
    const d = parseDate(j.date)
    return d && (!start || d >= start) ? s + Math.max(0, baseline - j.pickups) : s
  }, 0)

  // Consecutive days with a reflection, ending today (or yesterday if today isn't written yet).
  const days = new Set(journals.map((j) => normalize(j.date)))
  let streak = 0
  let cursor = days.has(toISODate(today)) ? today : addDays(today, -1)
  while (days.has(toISODate(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }

  const goal = profile.dailyPickupGoal
  return {
    dayNumber,
    started,
    avgPickups7: avg((j) => j.pickups),
    pickupsAvoided,
    avgUrge7: avg((j) => j.urgeLevel),
    avgMood7: avg((j) => j.mood),
    streak,
    goalDays7: goal > 0 ? recent.filter((j) => j.pickups <= goal).length : 0,
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
  pickups: number | null
  urge: number | null
  mood: number | null
}

export function lastNDays(journals: Journal[], n: number): DayPoint[] {
  const today = startOfDay(new Date())
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    const j = findByDate(journals, toISODate(date))
    return j ? { date, pickups: j.pickups, urge: j.urgeLevel, mood: j.mood } : { date, pickups: null, urge: null, mood: null }
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
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

export const moodOf = (n: number) => MOODS[Math.min(5, Math.max(1, Math.round(n))) - 1]

export function urgeLabel(n: number): string {
  if (n <= 2) return 'Barely there'
  if (n <= 4) return 'Mild'
  if (n <= 6) return 'Noticeable'
  if (n <= 8) return 'Strong'
  return 'Constant pull'
}

/** Colour for an urge level, from sage (calm) to coral (strong). */
export function urgeColor(n: number): string {
  if (n <= 2) return 'var(--sage)'
  if (n <= 4) return 'var(--olive)'
  if (n <= 6) return 'var(--amber)'
  if (n <= 8) return 'var(--coral)'
  return 'var(--rose)'
}

export function firstLine(j: Journal): string {
  return (j.dayReflection || j.win || j.gratitude || j.improvement || '').split('\n')[0]
}
