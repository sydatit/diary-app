import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, PenLine, Search } from 'lucide-react'
import { useJournals } from '../lib/useJournals'
import { EntryCard } from '../components/EntryCard'
import { EmptyState } from '../components/EmptyState'
import { FullPageSpinner } from '../components/Spinner'
import { Alert } from '../components/Alert'
import { parseDate } from '../lib/date'
import { useI18n } from '../i18n'
import type { Journal as Entry } from '../types'

export default function Journal() {
  const { journals, loading, error } = useJournals()
  const { t, fmt } = useI18n()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = journals.filter((j) => {
      if (!q) return true
      return [j.dayReflection, j.gratitude, j.win, j.improvement].some((t) => (t ?? '').toLowerCase().includes(q))
    })
    const map = new Map<string, Entry[]>()
    for (const j of list) {
      const d = parseDate(j.date)
      const key = d ? fmt.month(d) : t('journal.undated')
      map.set(key, [...(map.get(key) ?? []), j])
    }
    return [...map.entries()]
  }, [journals, query, fmt, t])

  if (loading) return <FullPageSpinner />

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {t(journals.length === 1 ? 'journal.count_one' : 'journal.count_other', { n: journals.length })}
          </p>
          <h1>{t('journal.title')}</h1>
        </div>
        <Link to="/journal/new" className="btn btn-primary hide-mobile">
          <PenLine size={16} />
          <span>{t('nav.reflectToday')}</span>
        </Link>
      </header>

      <Alert>{error}</Alert>

      {journals.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title={t('journal.emptyTitle')}
          text={t('journal.emptyText')}
          action={
            <Link to="/journal/new" className="btn btn-primary">
              <PenLine size={16} />
              <span>{t('journal.writeFirst')}</span>
            </Link>
          }
        />
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input placeholder={t('journal.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="muted center-pad">{t('journal.noMatch')}</p>
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
