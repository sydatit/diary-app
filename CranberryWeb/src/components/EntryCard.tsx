import { Link } from 'react-router-dom'
import { Smartphone } from 'lucide-react'
import type { Journal } from '../types'
import { parseDate, fmt } from '../lib/date'
import { firstLine, moodOf } from '../lib/stats'
import { UrgeDots } from './UrgeSlider'

export function EntryCard({ entry, goal }: { entry: Journal; goal: number }) {
  const d = parseDate(entry.date)
  const mood = moodOf(entry.mood)
  const met = goal > 0 && entry.pickups <= goal
  const text = firstLine(entry)
  return (
    <Link to={`/journal/${entry.journalId}`} className="entry">
      <div className="entry-date">
        <span className="entry-day">{d ? fmt.dayNum(d) : '–'}</span>
        <span className="entry-wd">{d ? fmt.weekday(d) : ''}</span>
      </div>
      <div className="entry-body">
        <div className="entry-meta">
          <span className="entry-mood" title={mood.label}>
            {mood.emoji}
          </span>
          <span className={`entry-pickups ${met ? 'met' : 'over'}`} title={goal ? `Goal: ${goal}` : undefined}>
            <Smartphone size={13} />
            {entry.pickups} pickups
          </span>
          <UrgeDots value={entry.urgeLevel} />
        </div>
        <p className={`entry-notes ${text ? '' : 'muted'}`}>{text || 'No reflection written'}</p>
      </div>
    </Link>
  )
}
