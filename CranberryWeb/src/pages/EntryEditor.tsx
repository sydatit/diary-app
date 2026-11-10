import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { journalsApi } from '../api/journals'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Stepper } from '../components/Stepper'
import { UrgeSlider } from '../components/UrgeSlider'
import { MoodPicker } from '../components/MoodPicker'
import { AutoTextarea } from '../components/AutoTextarea'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { FullPageSpinner } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { fmt, normalizeDate, parseDate, toISODate } from '../lib/date'
import { findByDate } from '../lib/stats'
import type { Journal, JournalInput } from '../types'

const EMPTY: JournalInput = {
  date: toISODate(),
  mood: 3,
  urgeLevel: 5,
  pickups: 0,
  dayReflection: '',
  gratitude: '',
  win: '',
  improvement: '',
}

export default function EntryEditor() {
  const { id } = useParams()
  const isNew = !id
  const { userId, profile } = useAuth()
  const goal = profile?.dailyPickupGoal ?? 0
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<JournalInput>({ ...EMPTY, date: toISODate() })
  const [existing, setExisting] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    if (isNew) {
      // One reflection per day: if today's already exists, open it instead.
      journalsApi
        .list(userId)
        .then((list) => {
          const today = findByDate(list, toISODate())
          if (today) navigate(`/journal/${today.journalId}`, { replace: true })
          else setExisting(list)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
      return
    }
    journalsApi
      .get(userId, Number(id))
      .then((j) =>
        setForm({
          date: normalizeDate(j.date) || toISODate(),
          mood: Math.min(5, Math.max(1, j.mood || 3)),
          urgeLevel: Math.min(10, Math.max(1, j.urgeLevel || 5)),
          pickups: j.pickups,
          dayReflection: j.dayReflection ?? '',
          gratitude: j.gratitude ?? '',
          win: j.win ?? '',
          improvement: j.improvement ?? '',
        }),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew, userId, navigate])

  const set = <K extends keyof JournalInput>(k: K, v: JournalInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  // Voice summary: fill an empty reflection, otherwise append on a new line so the user can review before saving.
  // Functional update keeps anything typed while the AI was working.
  function addVoiceSummary(summary: string) {
    setForm((f) => {
      const cur = f.dayReflection ?? ''
      return { ...f, dayReflection: cur.trim() ? `${cur.replace(/\s+$/, '')}\n${summary}` : summary }
    })
    toast('Đã thêm tóm tắt từ ghi âm')
  }
  const clash = isNew ? findByDate(existing, form.date) : undefined
  const hasText = [form.dayReflection, form.gratitude, form.win, form.improvement].some((t) => (t ?? '').trim())

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!userId || clash) return
    if (!hasText) {
      setError('Write at least one of the four reflections.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isNew) await journalsApi.create(userId, form)
      else await journalsApi.update(userId, Number(id), form)
      toast(isNew ? 'Reflection saved' : 'Reflection updated')
      navigate('/journal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setSaving(false)
    }
  }

  async function remove() {
    if (!userId) return
    setDeleting(true)
    try {
      await journalsApi.remove(userId, Number(id))
      toast('Reflection deleted')
      navigate('/journal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
      setDeleting(false)
      setConfirm(false)
    }
  }

  if (loading) return <FullPageSpinner />
  const d = parseDate(form.date)

  return (
    <div className="page narrow">
      <button className="back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
      <header className="page-head">
        <div>
          <p className="eyebrow">{isNew ? 'New reflection' : 'Edit reflection'}</p>
          <h1>{d ? fmt.long(d) : 'Reflection'}</h1>
        </div>
        {!isNew && (
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)} aria-label="Delete reflection" className="danger-text" />
        )}
      </header>

      <form onSubmit={save} className="editor">
        <section className="card editor-section">
          <h2 className="editor-title">Check-in</h2>
          <Field label="Date" type="date" required max={toISODate()} value={form.date} onChange={(e) => set('date', e.target.value)} />
          {clash && (
            <p className="notice">
              You already wrote a reflection for this day. <Link to={`/journal/${clash.journalId}`}>Open it</Link>
            </p>
          )}

          <div className="field">
            <label>How did you feel overall?</label>
            <MoodPicker value={form.mood} onChange={(n) => set('mood', n)} />
          </div>

          <div className="field">
            <label>How strong was the urge to grab your phone?</label>
            <UrgeSlider value={form.urgeLevel} onChange={(n) => set('urgeLevel', n)} />
          </div>

          <div className="field">
            <label>Phone pickups today</label>
            <div className="row between">
              <Stepper value={form.pickups} onChange={(n) => set('pickups', n)} max={2000} label="Phone pickups" />
              {goal > 0 && (
                <span className={`pill ${form.pickups <= goal ? 'pill-good' : 'pill-muted'}`}>
                  {form.pickups <= goal ? `Within your goal of ${goal} 🌿` : `${form.pickups - goal} over your goal`}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="card editor-section">
          <h2 className="editor-title">Reflection</h2>
          <VoiceRecorder onSummary={addVoiceSummary} />
          <AutoTextarea
            label="How was today?"
            placeholder="What happened, how you spent your time, how the phone fit in…"
            value={form.dayReflection ?? ''}
            onChange={(v) => set('dayReflection', v)}
            maxLength={4000}
          />
          <AutoTextarea
            label="What am I grateful for?"
            placeholder="A person, a moment, something small…"
            value={form.gratitude ?? ''}
            onChange={(v) => set('gratitude', v)}
            maxLength={2000}
          />
          <AutoTextarea
            label="What did I do well?"
            placeholder="Left the phone in another room at dinner…"
            value={form.win ?? ''}
            onChange={(v) => set('win', v)}
            maxLength={2000}
          />
          <AutoTextarea
            label="One thing to improve"
            placeholder="Tomorrow I'll…"
            value={form.improvement ?? ''}
            onChange={(v) => set('improvement', v)}
            maxLength={2000}
          />
        </section>

        <Alert>{error}</Alert>
        <div className="row end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!!clash}>
            {isNew ? 'Save reflection' : 'Save changes'}
          </Button>
        </div>
      </form>

      <Modal
        open={confirm}
        title="Delete this reflection?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        <p className="muted">This can't be undone.</p>
      </Modal>
    </div>
  )
}
