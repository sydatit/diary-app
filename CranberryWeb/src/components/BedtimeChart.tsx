import type { DayPoint } from '../lib/stats'
import { bedtimeColor, bedtimeToMinutes, minutesToBedtime } from '../lib/sleep'
import { useI18n } from '../i18n'

/** Dots = the time the user went to bed (earlier is higher), one column per day. */
export function BedtimeChart({ data }: { data: DayPoint[] }) {
  const { t, fmt } = useI18n()
  const mins = data.map((d) => bedtimeToMinutes(d.bedtime))
  const logged = mins.filter((m): m is number => m != null)
  if (!logged.length) return null

  const W = 640
  const H = 150
  const padX = 8
  const left = 66 // room for the hour labels (they are drawn twice as large on phones)
  const top = 12
  const bottom = 26
  const plotH = H - top - bottom
  const step = (W - left - padX) / data.length
  const x = (i: number) => left + step * i + step / 2

  // Whole-hour range covering the data, never narrower than 22:00–02:00 so one late night stays in scale.
  const lo = Math.floor(Math.min(10 * 60, ...logged) / 60) * 60
  const hi = Math.ceil(Math.max(14 * 60, ...logged) / 60) * 60
  const y = (m: number) => top + ((m - lo) / (hi - lo)) * plotH
  const hours = (hi - lo) / 60
  const every = hours <= 5 ? 1 : hours <= 10 ? 2 : 4
  const ticks: number[] = []
  for (let m = lo; m <= hi; m += every * 60) ticks.push(m)

  const segments: string[] = []
  let cur = ''
  mins.forEach((m, i) => {
    if (m == null) {
      if (cur) segments.push(cur)
      cur = ''
      return
    }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(m).toFixed(1)}`
  })
  if (cur) segments.push(cur)

  return (
    <div className="chart chart-bedtime">
      <h3 className="chart-title">{t('chart.bedtimeTitle')}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.bedtimeTitle')}>
        {ticks.map((m) => (
          <g key={m}>
            <line x1={left} x2={W} y1={y(m)} y2={y(m)} className="chart-grid" />
            <text x={0} y={y(m) + 4} className="chart-label">
              {minutesToBedtime(m)}
            </text>
          </g>
        ))}
        {segments.map((s, i) => (
          <path key={i} d={s} className="chart-line chart-line-soft" />
        ))}
        {data.map((d, i) => {
          const m = mins[i]
          return (
            <g key={i}>
              {m != null && (
                <circle cx={x(i)} cy={y(m)} r={4.5} className="chart-bed-dot" style={{ fill: bedtimeColor(d.bedtime!) }}>
                  <title>
                    {fmt.short(d.date)}: {t('chart.bedtime', { time: d.bedtime! })}
                  </title>
                </circle>
              )}
              <text x={x(i)} y={H - 6} className="chart-label" textAnchor="middle">
                {i % 2 === data.length % 2 || data.length <= 7 ? fmt.dayNum(d.date) : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
