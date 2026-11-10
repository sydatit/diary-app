import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, PenLine, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useJournals } from '../lib/useJournals'
import { EntryCard } from '../components/EntryCard'
import { EmptyState } from '../components/EmptyState'
import { FullPageSpinner } from '../components/Spinner'
import { Alert } from '../components/Alert'
import { fmt, parseDate } from '../lib/date'
import type { Journal as Entry } from '../types'

type Filter = 'all' | 'met' | 'over'

export default function Journal() {
  const { profile } = useAuth()
  const goal = profile?.dailyPickupGoal ?? 0
  const { journals, loading, error } = useJournals()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = journals.filter((j) => {
      if (filter === 'met' && j.pickups > goal) return false
      if (filter === 'over' && j.pickups <= goal) return false
      if (!q) return true
      return [j.dayReflection, j.gratitude, j.win, j.improvement].some((t) => (t ?? '').toLowerCase().includes(q))
    })
    const map = new Map<string, Entry[]>()
    for (const j of list) {
      const d = parseDate(j.date)
      const key = d ? fmt.month(d) : 'Undated'
      map.set(key, [...(map.get(key) ?? []), j])
    }
    return [...map.entries()]
  }, [journals, query, filter, goal])

  if (loading) return <FullPageSpinner />

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {journals.length} {journals.length === 1 ? 'reflection' : 'reflections'}
          </p>
          <h1>Journal</h1>
        </div>
        <Link to="/journal/new" className="btn btn-primary hide-mobile">
          <PenLine size={16} />
          <span>Reflect on today</span>
        </Link>
      </header>

      <Alert>{error}</Alert>

      {journals.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title="Your journal is empty"
          text="Each evening, note how the day went, what you're grateful for, what you did well and one thing to improve."
          action={
            <Link to="/journal/new" className="btn btn-primary">
              <PenLine size={16} />
              <span>Write your first reflection</span>
            </Link>
          }
        />
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input placeholder="Search reflections…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="segmented">
              {(
                [
                  ['all', 'All'],
                  ['met', 'Goal met'],
                  ['over', 'Over goal'],
                ] as [Filter, string][]
              ).map(([v, label]) => (
                <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="muted center-pad">No reflections match.</p>
          ) : (
            groups.map(([month, items]) => (
              <section key={month} className="month">
                <h2 className="month-title">{month}</h2>
                <div className="entries">
                  {items.map((j) => (
                    <EntryCard key={j.journalId} entry={j} goal={goal} />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
