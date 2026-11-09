import type { DayPoint } from '../lib/stats'
import { fmt } from '../lib/date'

/** Bars = cigarettes smoked per day, line = average craving (0–10). */
export function TrendChart({ data }: { data: DayPoint[] }) {
  const W = 640
  const H = 180
  const padX = 8
  const top = 12
  const bottom = 26
  const plotH = H - top - bottom
  const step = (W - padX * 2) / data.length
  const barW = Math.min(22, step * 0.5)
  const maxCigs = Math.max(4, ...data.map((d) => d.cigs ?? 0))

  const x = (i: number) => padX + step * i + step / 2
  const yCig = (v: number) => top + plotH - (v / maxCigs) * plotH
  const yCrav = (v: number) => top + plotH - (v / 10) * plotH

  const pts = data.map((d, i) => (d.craving == null ? null : [x(i), yCrav(d.craving)] as const))
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
          const logged = d.cigs != null
          const h = logged ? Math.max(3, top + plotH - yCig(d.cigs!)) : 3
          return (
            <g key={i}>
              <title>
                {fmt.short(d.date)}: {logged ? `${d.cigs} cigarettes · craving ${d.craving!.toFixed(1)}` : 'no entry'}
              </title>
              <rect
                x={x(i) - barW / 2}
                y={top + plotH - h}
                width={barW}
                height={h}
                rx={4}
                className={!logged ? 'chart-bar empty' : d.cigs === 0 ? 'chart-bar zero' : 'chart-bar'}
              />
              <text x={x(i)} y={H - 8} className="chart-label" textAnchor="middle">
                {i % 2 === data.length % 2 || data.length <= 7 ? fmt.dayNum(d.date) : ''}
              </text>
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
          <i className="lg-bar" /> Cigarettes
        </span>
        <span>
          <i className="lg-zero" /> Smoke-free day
        </span>
        <span>
          <i className="lg-line" /> Craving
        </span>
      </div>
    </div>
  )
}
