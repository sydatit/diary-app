import type { Journal, UserProfile } from '../types'
import { addDays, daysBetween, parseDate, startOfDay, toISODate } from './date'

export interface Stats {
  daysFree: number
  started: boolean
  cigsAvoided: number
  moneySaved: number
  cigsSinceQuit: number
  avgCraving7: number | null
  entries7: number
  streak: number
}

export function computeStats(profile: UserProfile, journals: Journal[]): Stats {
  const today = startOfDay(new Date())
  const quit = parseDate(profile.quitDate)
  const daysFree = quit ? Math.max(0, daysBetween(quit, today)) : 0
  const started = !!quit && quit <= today

  const cigsSinceQuit = journals.reduce((sum, j) => {
    const d = parseDate(j.date)
    return d && quit && d >= quit ? sum + (j.cigsSmoked || 0) : sum
  }, 0)

  const cigsAvoided = Math.max(0, daysFree * (profile.avgSmokedDaily || 0) - cigsSinceQuit)
  const perCig = profile.cigsPerPack > 0 ? profile.pricePerPack / profile.cigsPerPack : 0
  const moneySaved = cigsAvoided * perCig

  const weekAgo = addDays(today, -6)
  const recent = journals.filter((j) => {
    const d = parseDate(j.date)
    return d && d >= weekAgo && d <= today
  })
  const avgCraving7 = recent.length ? recent.reduce((s, j) => s + j.cravingIntensity, 0) / recent.length : null

  // Consecutive days (ending today or yesterday) with a journal entry and zero cigarettes.
  const byDay = groupByDay(journals)
  let streak = 0
  let cursor = byDay.has(toISODate(today)) ? today : addDays(today, -1)
  while (true) {
    const list = byDay.get(toISODate(cursor))
    if (!list || list.some((j) => j.cigsSmoked > 0)) break
    streak++
    cursor = addDays(cursor, -1)
  }

  return { daysFree, started, cigsAvoided, moneySaved, cigsSinceQuit, avgCraving7, entries7: recent.length, streak }
}

export function groupByDay(journals: Journal[]): Map<string, Journal[]> {
  const map = new Map<string, Journal[]>()
  for (const j of journals) {
    const d = parseDate(j.date)
    if (!d) continue
    const key = toISODate(d)
    const list = map.get(key)
    if (list) list.push(j)
    else map.set(key, [j])
  }
  return map
}

export interface DayPoint {
  date: Date
  cigs: number | null
  craving: number | null
}

export function lastNDays(journals: Journal[], n: number): DayPoint[] {
  const byDay = groupByDay(journals)
  const today = startOfDay(new Date())
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    const list = byDay.get(toISODate(date))
    if (!list) return { date, cigs: null, craving: null }
    return {
      date,
      cigs: list.reduce((s, j) => s + j.cigsSmoked, 0),
      craving: list.reduce((s, j) => s + j.cravingIntensity, 0) / list.length,
    }
  })
}

export function sortByDateDesc(journals: Journal[]): Journal[] {
  return [...journals].sort((a, b) => {
    const da = parseDate(a.date)?.getTime() ?? 0
    const db = parseDate(b.date)?.getTime() ?? 0
    return db - da || b.journalId - a.journalId
  })
}

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 1000 ? 0 : 2 })

export function cravingLabel(n: number): string {
  if (n <= 2) return 'Calm'
  if (n <= 4) return 'Mild'
  if (n <= 6) return 'Noticeable'
  if (n <= 8) return 'Strong'
  return 'Intense'
}

/** Colour for a craving level, from sage (calm) to cranberry (intense). */
export function cravingColor(n: number): string {
  if (n <= 2) return 'var(--sage)'
  if (n <= 4) return 'var(--olive)'
  if (n <= 6) return 'var(--amber)'
  if (n <= 8) return 'var(--coral)'
  return 'var(--accent)'
}
