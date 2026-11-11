/** Local date as YYYY-MM-DD. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse the API's free-form date strings, preferring YYYY-MM-DD as a local date. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function normalizeDate(value: string | null | undefined): string {
  const d = parseDate(value)
  return d ? toISODate(d) : ''
}

const DAY = 86_400_000
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Date formatters bound to a locale; components get the current one from useI18n().fmt. */
export function makeFmt(locale: string) {
  const f = (opts: Intl.DateTimeFormatOptions) => (d: Date) => d.toLocaleDateString(locale, opts)
  return {
    long: f({ weekday: 'long', month: 'long', day: 'numeric' }),
    medium: f({ month: 'short', day: 'numeric', year: 'numeric' }),
    month: f({ month: 'long', year: 'numeric' }),
    weekday: f({ weekday: 'short' }),
    dayNum: (d: Date) => String(d.getDate()),
    short: f({ month: 'short', day: 'numeric' }),
  }
}
export type Fmt = ReturnType<typeof makeFmt>
