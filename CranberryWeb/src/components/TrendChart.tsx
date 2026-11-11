import type { DayPoint } from '../lib/stats'
import { levelColor, moodOf } from '../lib/stats'
import { fmt } from '../lib/date'

/** Bars = urge to grab the phone (1–10, coloured by level), line = stress (1–10), emoji row = mood. */
export function TrendChart({ data }: { data: DayPoint[] }) {
  const W = 640
  const H = 212
  const padX = 8
  const top = 12
  const bottom = 62
  const plotH = H - top - bottom
  const step = (W - padX * 2) / data.length
  const barW = Math.min(22, step * 0.5)

  const x = (i: number) => padX + step * i + step / 2
  const y = (v: number) => top + plotH - (v / 10) * plotH

  const pts = data.map((d, i) => (d.stress == null ? null : ([x(i), y(d.stress)] as const)))
  const segments: string[] = []
  let cur = ''
  for (const p of pts) {
    if (!p) {
      if (cur) segments.push(cur)
      cur = ''
      continue
    }
    cur += `${cur ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
  }
  if (cur) segments.push(cur)

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Last 14 days">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={W} y1={top + plotH * (1 - g)} y2={top + plotH * (1 - g)} className="chart-grid" />
        ))}
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} className="chart-axis" />
        {data.map((d, i) => {
          const logged = d.urge != null
          const h = logged ? Math.max(3, top + plotH - y(d.urge!)) : 3
          const stress = d.stress != null ? ` · stress ${d.stress}/10` : ''
          return (
            <g key={i}>
              <title>
                {fmt.short(d.date)}: {logged ? `urge ${d.urge}/10${stress} · ${moodOf(d.mood!).label}` : 'no entry'}
              </title>
              <rect
                x={x(i) - barW / 2}
                y={top + plotH - h}
                width={barW}
                height={h}
                rx={4}
                className={`chart-bar${logged ? '' : ' empty'}`}
                style={logged ? { fill: levelColor(d.urge!) } : undefined}
              />
              <text x={x(i)} y={top + plotH + 18} className="chart-label" textAnchor="middle">
                {i % 2 === data.length % 2 || data.length <= 7 ? fmt.dayNum(d.date) : ''}
              </text>
              {d.mood != null && (
                <text x={x(i)} y={H - 6} className="chart-mood" textAnchor="middle">
                  {moodOf(d.mood).emoji}
                </text>
              )}
            </g>
          )
        })}
        {segments.map((s, i) => (
          <path key={i} d={s} className="chart-line" />
        ))}
        {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} className="chart-dot" />)}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="lg-urge" /> Urge to grab the phone
        </span>
        <span>
          <i className="lg-line" /> Stress
        </span>
      </div>
    </div>
  )
}
