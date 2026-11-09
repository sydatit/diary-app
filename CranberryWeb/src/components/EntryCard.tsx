import { Link } from 'react-router-dom'
import { Cigarette, Leaf } from 'lucide-react'
import type { Journal } from '../types'
import { parseDate, fmt } from '../lib/date'
import { CravingDots } from './CravingSlider'

export function EntryCard({ entry }: { entry: Journal }) {
  const d = parseDate(entry.date)
  return (
    <Link to={`/journal/${entry.journalId}`} className="entry">
      <div className="entry-date">
        <span className="entry-day">{d ? fmt.dayNum(d) : '–'}</span>
        <span className="entry-wd">{d ? fmt.weekday(d) : ''}</span>
      </div>
      <div className="entry-body">
        <div className="entry-meta">
          <CravingDots value={entry.cravingIntensity} />
          <span className={`entry-cigs ${entry.cigsSmoked === 0 ? 'free' : ''}`}>
            {entry.cigsSmoked === 0 ? <Leaf size={14} /> : <Cigarette size={14} />}
            {entry.cigsSmoked === 0 ? 'Smoke-free' : `${entry.cigsSmoked} smoked`}
          </span>
        </div>
        <p className={`entry-notes ${entry.notes ? '' : 'muted'}`}>{entry.notes || 'No notes'}</p>
      </div>
    </Link>
  )
}
