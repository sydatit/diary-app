import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Flame, PenLine, PiggyBank, Sparkles, Wind } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useJournals } from '../lib/useJournals'
import { computeStats, cravingLabel, lastNDays, money } from '../lib/stats'
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

const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365]

export default function Dashboard() {
  const { profile } = useAuth()
  const { journals, loading, error } = useJournals()
  if (!profile) return null

  const stats = computeStats(profile, journals)
  const today = toISODate()
  const loggedToday = journals.find((j) => parseDate(j.date) && toISODate(parseDate(j.date)!) === today)
  const nextMilestone = MILESTONES.find((m) => m > stats.daysFree) ?? Math.ceil((stats.daysFree + 1) / 365) * 365
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= stats.daysFree) ?? 0
  const progress = (stats.daysFree - prevMilestone) / (nextMilestone - prevMilestone)
  const quit = parseDate(profile.quitDate)

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
          {stats.started ? (
            <>
              <span className="hero-number">{stats.daysFree}</span>
              <div>
                <p className="hero-label">{stats.daysFree === 1 ? 'day' : 'days'} smoke-free</p>
                <p className="muted small">Since {quit ? fmt.medium(quit) : '—'}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="hero-label">Your quit date is coming up</p>
              <p className="muted small">{quit ? `Starting ${fmt.medium(quit)}` : 'Set a quit date in Settings.'}</p>
            </div>
          )}
        </div>
        {stats.started && (
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
        {!loggedToday ? (
          <Link to="/journal/new" className="btn btn-primary hero-cta">
            <PenLine size={16} />
            <span>How are you today?</span>
          </Link>
        ) : (
          <Link to={`/journal/${loggedToday.journalId}`} className="hero-done">
            <Sparkles size={16} /> You've checked in today
          </Link>
        )}
      </section>

      <section className="stats">
        <Stat icon={<PiggyBank size={18} />} label="Money saved" value={money(stats.moneySaved)} />
        <Stat icon={<Ban size={18} />} label="Cigarettes avoided" value={Math.round(stats.cigsAvoided).toLocaleString()} />
        <Stat
          icon={<Wind size={18} />}
          label="Avg craving · 7 days"
          value={stats.avgCraving7 == null ? '—' : stats.avgCraving7.toFixed(1)}
          sub={stats.avgCraving7 == null ? 'No entries yet' : cravingLabel(stats.avgCraving7)}
        />
        <Stat
          icon={<Flame size={18} />}
          label="Check-in streak"
          value={String(stats.streak)}
          sub={stats.streak === 1 ? 'smoke-free day logged' : 'smoke-free days logged'}
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

      <section>
        <div className="section-head">
          <h2>Recent entries</h2>
          {journals.length > 0 && <Link to="/journal">View all</Link>}
        </div>
        {loading ? null : journals.length === 0 ? (
          <div className="card soft center-pad">
            <p className="muted">Your journal is empty. Your first entry starts the story.</p>
            <Link to="/journal/new" className="btn btn-secondary">
              <PenLine size={16} />
              <span>Write first entry</span>
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
