import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { journalsApi } from '../api/journals'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Stepper } from '../components/Stepper'
import { CravingSlider } from '../components/CravingSlider'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { FullPageSpinner } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { fmt, normalizeDate, parseDate, toISODate } from '../lib/date'
import type { JournalInput } from '../types'

const PROMPTS = [
  'What triggered a craving today?',
  'What helped you get through it?',
  'How is your body feeling?',
  'One thing you are proud of today…',
]

export default function EntryEditor() {
  const { id } = useParams()
  const isNew = !id
  const { userId } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<JournalInput>({ date: toISODate(), cravingIntensity: 3, cigsSmoked: 0, notes: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)])

  useEffect(() => {
    if (isNew || !userId) return
    journalsApi
      .get(userId, Number(id))
      .then((j) =>
        setForm({
          date: normalizeDate(j.date) || toISODate(),
          cravingIntensity: Math.min(10, Math.max(1, j.cravingIntensity || 1)),
          cigsSmoked: j.cigsSmoked,
          notes: j.notes ?? '',
        }),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew, userId])

  const set = <K extends keyof JournalInput>(k: K, v: JournalInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setError(null)
    try {
      const body = { ...form, notes: form.notes?.trim() ?? '' }
      if (isNew) await journalsApi.create(userId, body)
      else await journalsApi.update(userId, Number(id), body)
      toast(isNew ? 'Entry saved' : 'Entry updated')
      navigate('/journal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry.')
      setSaving(false)
    }
  }

  async function remove() {
    if (!userId) return
    setDeleting(true)
    try {
      await journalsApi.remove(userId, Number(id))
      toast('Entry deleted')
      navigate('/journal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete entry.')
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
          <p className="eyebrow">{isNew ? 'New entry' : 'Edit entry'}</p>
          <h1>{d ? fmt.long(d) : 'Journal entry'}</h1>
        </div>
        {!isNew && (
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)} aria-label="Delete entry" className="danger-text" />
        )}
      </header>

      <form onSubmit={save} className="card editor">
        <Alert>{error}</Alert>

        <Field label="Date" type="date" required max={toISODate()} value={form.date} onChange={(e) => set('date', e.target.value)} />

        <div className="field">
          <label>How strong were your cravings?</label>
          <CravingSlider value={form.cravingIntensity} onChange={(n) => set('cravingIntensity', n)} />
        </div>

        <div className="field">
          <label>Cigarettes smoked</label>
          <div className="row between">
            <Stepper value={form.cigsSmoked} onChange={(n) => set('cigsSmoked', n)} label="Cigarettes smoked" />
            <span className={`pill ${form.cigsSmoked === 0 ? 'pill-good' : 'pill-muted'}`}>
              {form.cigsSmoked === 0 ? 'Smoke-free 🌱' : 'A slip is not a fall'}
            </span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            rows={7}
            placeholder={prompt}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <div className="row end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? 'Save entry' : 'Save changes'}
          </Button>
        </div>
      </form>

      <Modal
        open={confirm}
        title="Delete this entry?"
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
