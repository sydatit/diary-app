import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, PenLine, Search } from 'lucide-react'
import { useJournals } from '../lib/useJournals'
import { EntryCard } from '../components/EntryCard'
import { EmptyState } from '../components/EmptyState'
import { FullPageSpinner } from '../components/Spinner'
import { Alert } from '../components/Alert'
import { fmt, parseDate } from '../lib/date'
import type { Journal as Entry } from '../types'

type Filter = 'all' | 'free' | 'smoked'

export default function Journal() {
  const { journals, loading, error } = useJournals()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = journals.filter((j) => {
      if (filter === 'free' && j.cigsSmoked > 0) return false
      if (filter === 'smoked' && j.cigsSmoked === 0) return false
      return !q || (j.notes ?? '').toLowerCase().includes(q)
    })
    const map = new Map<string, Entry[]>()
    for (const j of list) {
      const d = parseDate(j.date)
      const key = d ? fmt.month(d) : 'Undated'
      map.set(key, [...(map.get(key) ?? []), j])
    }
    return [...map.entries()]
  }, [journals, query, filter])

  if (loading) return <FullPageSpinner />

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{journals.length} {journals.length === 1 ? 'entry' : 'entries'}</p>
          <h1>Journal</h1>
        </div>
        <Link to="/journal/new" className="btn btn-primary hide-mobile">
          <PenLine size={16} />
          <span>New entry</span>
        </Link>
      </header>

      <Alert>{error}</Alert>

      {journals.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title="Nothing here yet"
          text="Write a few lines each day about your cravings and how you feel. Patterns will appear over time."
          action={
            <Link to="/journal/new" className="btn btn-primary">
              <PenLine size={16} />
              <span>Write your first entry</span>
            </Link>
          }
        />
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="segmented">
              {(
                [
                  ['all', 'All'],
                  ['free', 'Smoke-free'],
                  ['smoked', 'Slips'],
                ] as [Filter, string][]
              ).map(([v, label]) => (
                <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="muted center-pad">No entries match your search.</p>
          ) : (
            groups.map(([month, items]) => (
              <section key={month} className="month">
                <h2 className="month-title">{month}</h2>
                <div className="entries">
                  {items.map((j) => (
                    <EntryCard key={j.journalId} entry={j} />
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
