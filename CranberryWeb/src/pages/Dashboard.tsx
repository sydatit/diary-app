import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Flame, Heart, PenLine, Smile, Sparkles, Star, Waves } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useJournals } from '../lib/useJournals'
import { computeStats, findByDate, lastNDays, moodOf, stressLabel, urgeLabel } from '../lib/stats'
import { fmt, parseDate, toISODate } from '../lib/date'
import { TrendChart } from '../components/TrendChart'
import { EntryCard } from '../components/EntryCard'
import { Spinner } from '../components/Spinner'
import { Alert } from '../components/Alert'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365]

export default function Dashboard() {
  const { profile } = useAuth()
  const { journals, loading, error } = useJournals()
  if (!profile) return null

  const s = computeStats(profile, journals)
  const todayEntry = findByDate(journals, toISODate())
  const nextMilestone = MILESTONES.find((m) => m > s.dayNumber) ?? Math.ceil((s.dayNumber + 1) / 365) * 365
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= s.dayNumber) ?? 0
  const progress = (s.dayNumber - prevMilestone) / (nextMilestone - prevMilestone)
  const start = parseDate(profile.detoxStartDate)
  const highlight = journals.find((j) => j.gratitude || j.win)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{fmt.long(new Date())}</p>
          <h1>
            {greeting()}, {profile.userName}
          </h1>
        </div>
      </header>

      <section className="hero card">
        <div className="hero-main">
          {s.started ? (
            <>
              <span className="hero-number">{s.dayNumber}</span>
              <div>
                <p className="hero-label">{s.dayNumber === 1 ? 'Day one' : 'days'} of unplugging</p>
                <p className="muted small">Since {start ? fmt.medium(start) : '—'}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="hero-label">Your detox starts soon</p>
              <p className="muted small">{start ? `Starting ${fmt.medium(start)}` : 'Set a start date in Settings.'}</p>
            </div>
          )}
        </div>
        {s.started && (
          <div className="milestone">
            <div className="milestone-text">
              <span>Next milestone</span>
              <strong>{nextMilestone} days</strong>
            </div>
            <div className="bar">
              <span style={{ width: `${Math.min(100, Math.max(4, progress * 100))}%` }} />
            </div>
          </div>
        )}
        {!todayEntry ? (
          <Link to="/journal/new" className="btn btn-primary hero-cta">
            <PenLine size={16} />
            <span>Reflect on today</span>
          </Link>
        ) : (
          <Link to={`/journal/${todayEntry.journalId}`} className="hero-done">
            <Sparkles size={16} /> You've reflected today
          </Link>
        )}
      </section>

      <section className="stats">
        <Stat
          icon={<Activity size={18} />}
          label="Avg stress · 7 days"
          value={s.avgStress7 == null ? '—' : s.avgStress7.toFixed(1)}
          sub={s.avgStress7 == null ? 'No entries yet' : stressLabel(s.avgStress7)}
        />
        <Stat
          icon={<Smile size={18} />}
          label="Avg mood · 7 days"
          value={s.avgMood7 == null ? '—' : moodOf(s.avgMood7).emoji}
          sub={s.avgMood7 == null ? 'No entries yet' : moodOf(s.avgMood7).label}
        />
        <Stat
          icon={<Waves size={18} />}
          label="Avg urge · 7 days"
          value={s.avgUrge7 == null ? '—' : s.avgUrge7.toFixed(1)}
          sub={s.avgUrge7 == null ? 'No entries yet' : urgeLabel(s.avgUrge7)}
        />
        <Stat
          icon={<Flame size={18} />}
          label="Reflection streak"
          value={String(s.streak)}
          sub={`${s.streak === 1 ? 'day' : 'days'} · wrote ${s.entries7}/7 this week`}
        />
      </section>

      <Alert>{error}</Alert>

      <section className="card">
        <div className="section-head">
          <h2>Last 14 days</h2>
        </div>
        {loading ? (
          <div className="center-pad">
            <Spinner />
          </div>
        ) : (
          <TrendChart data={lastNDays(journals, 14)} />
        )}
      </section>

      {highlight && (
        <section className="highlights">
          {highlight.gratitude && (
            <div className="card highlight">
              <span className="highlight-icon">
                <Heart size={16} />
              </span>
              <div>
                <p className="eyebrow">Grateful for · {fmt.short(parseDate(highlight.date)!)}</p>
                <p className="highlight-text">{highlight.gratitude}</p>
              </div>
            </div>
          )}
          {highlight.win && (
            <div className="card highlight">
              <span className="highlight-icon">
                <Star size={16} />
              </span>
              <div>
                <p className="eyebrow">Did well · {fmt.short(parseDate(highlight.date)!)}</p>
                <p className="highlight-text">{highlight.win}</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Recent reflections</h2>
          {journals.length > 0 && <Link to="/journal">View all</Link>}
        </div>
        {loading ? null : journals.length === 0 ? (
          <div className="card soft center-pad">
            <p className="muted">No reflections yet. Take two minutes tonight to write your first.</p>
            <Link to="/journal/new" className="btn btn-secondary">
              <PenLine size={16} />
              <span>Write first reflection</span>
            </Link>
          </div>
        ) : (
          <div className="entries">
            {journals.slice(0, 3).map((j) => (
              <EntryCard key={j.journalId} entry={j} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="stat card">
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}
