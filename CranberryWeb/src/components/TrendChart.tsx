import type { DayPoint } from '../lib/stats'
import { moodOf } from '../lib/stats'
import { fmt } from '../lib/date'

/** Bars = phone pickups per day (green when within goal), line = urge (1–10), emoji row = mood. */
export function TrendChart({ data, goal }: { data: DayPoint[]; goal: number }) {
  const W = 640
  const H = 212
  const padX = 8
  const top = 12
  const bottom = 62
  const plotH = H - top - bottom
  const step = (W - padX * 2) / data.length
  const barW = Math.min(22, step * 0.5)
  const maxP = Math.max(goal * 1.4, 10, ...data.map((d) => d.pickups ?? 0))

  const x = (i: number) => padX + step * i + step / 2
  const yP = (v: number) => top + plotH - (v / maxP) * plotH
  const yU = (v: number) => top + plotH - (v / 10) * plotH

  const pts = data.map((d, i) => (d.urge == null ? null : ([x(i), yU(d.urge)] as const)))
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
        {goal > 0 && goal < maxP && (
          <g>
            <line x1={0} x2={W} y1={yP(goal)} y2={yP(goal)} className="chart-goal" />
            <text x={W - 4} y={yP(goal) - 5} textAnchor="end" className="chart-goal-label">
              goal {goal}
            </text>
          </g>
        )}
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} className="chart-axis" />
        {data.map((d, i) => {
          const logged = d.pickups != null
          const h = logged ? Math.max(3, top + plotH - yP(d.pickups!)) : 3
          const cls = !logged ? 'empty' : goal > 0 && d.pickups! <= goal ? 'met' : 'over'
          return (
            <g key={i}>
              <title>
                {fmt.short(d.date)}: {logged ? `${d.pickups} pickups · urge ${d.urge}/10 · ${moodOf(d.mood!).label}` : 'no entry'}
              </title>
              <rect x={x(i) - barW / 2} y={top + plotH - h} width={barW} height={h} rx={4} className={`chart-bar ${cls}`} />
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
          <i className="lg-met" /> Pickups within goal
        </span>
        <span>
          <i className="lg-over" /> Over goal
        </span>
        <span>
          <i className="lg-line" /> Urge
        </span>
      </div>
    </div>
  )
}
