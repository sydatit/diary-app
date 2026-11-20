import { Link } from 'react-router-dom'
import { Moon } from 'lucide-react'
import type { Journal } from '../types'
import { parseDate } from '../lib/date'
import { useI18n } from '../i18n'
import { firstLine, levelColor, moodOf, stressLabel } from '../lib/stats'
import { bedtimeColor, bedtimeLabel, isBedtime } from '../lib/sleep'
import { UrgeDots } from './UrgeSlider'

export function EntryCard({ entry }: { entry: Journal }) {
  const { t, fmt } = useI18n()
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
          <span className="entry-mood" title={t(mood.label)}>
            {mood.emoji}
          </span>
          <UrgeDots value={entry.urgeLevel} />
          {stress != null && (
            <span
              className="entry-stress"
              title={`${t('entry.stress', { n: stress })} · ${t(stressLabel(stress))}`}
              style={{ color: levelColor(stress), background: `color-mix(in srgb, ${levelColor(stress)} 12%, transparent)` }}
            >
              {t('entry.stress', { n: stress })}
            </span>
          )}
          {isBedtime(entry.bedtime) && (
            <span
              className="entry-stress"
              title={`${t('entry.bedtime', { time: entry.bedtime })} · ${t(bedtimeLabel(entry.bedtime))}`}
              style={{
                color: bedtimeColor(entry.bedtime),
                background: `color-mix(in srgb, ${bedtimeColor(entry.bedtime)} 12%, transparent)`,
              }}
            >
              <Moon size={12} aria-hidden /> {entry.bedtime}
            </span>
          )}
        </div>
        <p className={`entry-notes ${text ? '' : 'muted'}`}>{text || t('entry.noText')}</p>
      </div>
    </Link>
  )
}
