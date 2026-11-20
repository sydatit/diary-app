import { useState } from 'react'
import { Moon, Undo2 } from 'lucide-react'
import { Button } from './Button'
import { Alert } from './Alert'
import { useToast } from './Toast'
import { errorText, useI18n } from '../i18n'
import { bedtimeColor, bedtimeLabel, isBedtime, sleepNow } from '../lib/sleep'
import type { SleepLog } from '../types'

interface Props {
  sleep: SleepLog[]
  log: (date: string, bedtime: string) => Promise<void>
  undo: (date: string) => Promise<void>
}

/** One tap records "now" as tonight's bedtime; once recorded it shows the time and an undo. */
export function BedtimeButton({ sleep, log, undo }: Props) {
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tonight = sleepNow().date
  const logged = sleep.find((l) => l.date === tonight && isBedtime(l.bedtime))

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      toast(done)
    } catch (e) {
      setError(errorText(e, t, 'sleep.failed'))
    } finally {
      setBusy(false)
    }
  }

  function goToBed() {
    // Read the clock at the tap, not at render: the page may have been open for a while.
    const now = sleepNow()
    return run(() => log(now.date, now.bedtime), t('sleep.saved', { time: now.bedtime }))
  }

  return (
    <section className="card bedtime">
      {logged ? (
        <div className="bedtime-done">
          <span className="bedtime-icon" style={{ color: bedtimeColor(logged.bedtime) }}>
            <Moon size={18} />
          </span>
          <div className="bedtime-text">
            <strong>{t('sleep.loggedAt', { time: logged.bedtime })}</strong>
            <span className="muted small">{t(bedtimeLabel(logged.bedtime))}</span>
          </div>
          <Button variant="ghost" icon={<Undo2 size={16} />} loading={busy} onClick={() => run(() => undo(tonight), t('sleep.undone'))}>
            {t('sleep.undo')}
          </Button>
        </div>
      ) : (
        <Button block icon={<Moon size={18} />} loading={busy} onClick={goToBed}>
          {t('sleep.goNow')}
        </Button>
      )}
      <Alert>{error}</Alert>
    </section>
  )
}
