import { Link } from 'react-router-dom'
import type { Journal } from '../types'
import { parseDate, fmt } from '../lib/date'
import { firstLine, levelColor, moodOf, stressLabel } from '../lib/stats'
import { UrgeDots } from './UrgeSlider'

export function EntryCard({ entry }: { entry: Journal }) {
  const d = parseDate(entry.date)
  const mood = moodOf(entry.mood)
  const stress = entry.stressLevel
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
          <UrgeDots value={entry.urgeLevel} />
          {stress != null && (
            <span
              className="entry-stress"
              title={`Stress ${stress}/10 · ${stressLabel(stress)}`}
              style={{ color: levelColor(stress), background: `color-mix(in srgb, ${levelColor(stress)} 12%, transparent)` }}
            >
              Stress {stress}/10
            </span>
          )}
        </div>
        <p className={`entry-notes ${text ? '' : 'muted'}`}>{text || 'No reflection written'}</p>
      </div>
    </Link>
  )
}
