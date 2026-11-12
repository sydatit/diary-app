import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { journalsApi } from '../api/journals'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { StressSlider, UrgeSlider } from '../components/UrgeSlider'
import { MoodPicker } from '../components/MoodPicker'
import { AutoTextarea } from '../components/AutoTextarea'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { FullPageSpinner } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { appendLines, normalizeVoiceText } from '../lib/voiceText'
import type { DiarySection } from '../api/diary'
import { normalizeDate, parseDate, toISODate } from '../lib/date'
import { errorText, useI18n, type TKey } from '../i18n'
import { findByDate } from '../lib/stats'
import type { Journal, JournalInput } from '../types'

type TextField = 'dayReflection' | 'gratitude' | 'win' | 'improvement'

const PROMPTS: { field: TextField; section: DiarySection; label: TKey; placeholder: TKey; maxLength: number }[] = [
  { field: 'dayReflection', section: 'reflection', label: 'editor.dayQ', placeholder: 'editor.dayPh', maxLength: 4000 },
  { field: 'gratitude', section: 'gratitude', label: 'editor.gratitudeQ', placeholder: 'editor.gratitudePh', maxLength: 2000 },
  { field: 'win', section: 'win', label: 'editor.winQ', placeholder: 'editor.winPh', maxLength: 2000 },
  { field: 'improvement', section: 'improvement', label: 'editor.improveQ', placeholder: 'editor.improvePh', maxLength: 2000 },
]

const EMPTY: JournalInput = {
  date: toISODate(),
  mood: 3,
  urgeLevel: 5,
  stressLevel: 5,
  pickups: 0,
  dayReflection: '',
  gratitude: '',
  win: '',
  improvement: '',
}

export default function EntryEditor() {
  const { id } = useParams()
  const isNew = !id
  const { userId } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { t, fmt } = useI18n()
  const [form, setForm] = useState<JournalInput>({ ...EMPTY, date: toISODate() })
  const [existing, setExisting] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only one field records at a time; the other mics are locked meanwhile.
  const [voiceField, setVoiceField] = useState<TextField | null>(null)

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
          stressLevel: j.stressLevel ? Math.min(10, Math.max(1, j.stressLevel)) : 5,
          pickups: j.pickups ?? 0,
          dayReflection: j.dayReflection ?? '',
          gratitude: j.gratitude ?? '',
          win: j.win ?? '',
          improvement: j.improvement ?? '',
        }),
      )
      .catch((e) => setError(errorText(e, t)))
      .finally(() => setLoading(false))
  }, [id, isNew, userId, navigate])

  const set = <K extends keyof JournalInput>(k: K, v: JournalInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  // Voice summary: append its lines to the end of that field so the user can review before saving.
  // While the AI is still writing, the text so far is shown after what was in the box when it started
  // (`voiceBase`); the box is read-only during that so nothing typed gets overwritten.
  const formRef = useRef(form)
  formRef.current = form
  const voiceBase = useRef<Partial<Record<TextField, string>>>({})
  const [streamingField, setStreamingField] = useState<TextField | null>(null)

  function showVoice(field: TextField, maxLength: number, base: string, text: string) {
    setForm((f) => ({ ...f, [field]: appendLines(base, normalizeVoiceText(text)).slice(0, maxLength) }))
  }
  function partialVoice(field: TextField, maxLength: number, soFar: string) {
    if (voiceBase.current[field] === undefined) {
      voiceBase.current[field] = formRef.current[field] ?? ''
      setStreamingField(field)
    }
    showVoice(field, maxLength, voiceBase.current[field]!, soFar)
  }
  function endVoice(field: TextField) {
    const base = voiceBase.current[field]
    delete voiceBase.current[field]
    setStreamingField((cur) => (cur === field ? null : cur))
    return base
  }
  function addVoice(field: TextField, maxLength: number, summary: string) {
    showVoice(field, maxLength, endVoice(field) ?? formRef.current[field] ?? '', summary)
    toast(t('editor.voiceAdded'))
  }
  function abortVoice(field: TextField) {
    const base = endVoice(field)
    if (base !== undefined) setForm((f) => ({ ...f, [field]: base }))
  }
  const clash = isNew ? findByDate(existing, form.date) : undefined

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!userId || clash) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) await journalsApi.create(userId, form)
      else await journalsApi.update(userId, Number(id), form)
      toast(t(isNew ? 'editor.saved' : 'editor.updated'))
      navigate('/journal')
    } catch (err) {
      setError(errorText(err, t, 'editor.saveFailed'))
      setSaving(false)
    }
  }

  async function remove() {
    if (!userId) return
    setDeleting(true)
    try {
      await journalsApi.remove(userId, Number(id))
      toast(t('editor.deleted'))
      navigate('/journal')
    } catch (err) {
      setError(errorText(err, t, 'editor.deleteFailed'))
      setDeleting(false)
      setConfirm(false)
    }
  }

  if (loading) return <FullPageSpinner />
  const d = parseDate(form.date)

  return (
    <div className="page narrow">
      <button className="back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> {t('common.back')}
      </button>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t(isNew ? 'editor.new' : 'editor.edit')}</p>
          <h1>{d ? fmt.long(d) : t('editor.fallbackTitle')}</h1>
        </div>
        {!isNew && (
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)} aria-label={t('editor.delete')} className="danger-text" />
        )}
      </header>

      <form onSubmit={save} className="editor">
        <section className="card editor-section">
          <h2 className="editor-title">{t('editor.checkIn')}</h2>
          <Field label={t('editor.date')} type="date" required max={toISODate()} value={form.date} onChange={(e) => set('date', e.target.value)} />
          {clash && (
            <p className="notice">
              {t('editor.clash')} <Link to={`/journal/${clash.journalId}`}>{t('editor.openIt')}</Link>
            </p>
          )}

          <div className="field">
            <label>{t('editor.moodQ')}</label>
            <MoodPicker value={form.mood} onChange={(n) => set('mood', n)} />
          </div>

          <div className="field">
            <label>{t('editor.urgeQ')}</label>
            <UrgeSlider value={form.urgeLevel} onChange={(n) => set('urgeLevel', n)} />
          </div>

          <div className="field">
            <label>{t('editor.stressQ')}</label>
            <StressSlider value={form.stressLevel ?? 5} onChange={(n) => set('stressLevel', n)} />
          </div>
        </section>

        <section className="card editor-section">
          <h2 className="editor-title">{t('editor.reflection')}</h2>
          {PROMPTS.map(({ field, section, label, placeholder, maxLength }) => (
            <AutoTextarea
              key={field}
              label={t(label)}
              placeholder={t(placeholder)}
              value={form[field] ?? ''}
              onChange={(v) => set(field, v)}
              maxLength={maxLength}
              readOnly={streamingField === field}
              aria-busy={streamingField === field}
              addon={
                <VoiceRecorder
                  section={section}
                  disabled={voiceField !== null && voiceField !== field}
                  onBusyChange={(busy) => setVoiceField((cur) => (busy ? field : cur === field ? null : cur))}
                  onPartial={(text) => partialVoice(field, maxLength, text)}
                  onSummary={(text) => addVoice(field, maxLength, text)}
                  onAbort={() => abortVoice(field)}
                />
              }
            />
          ))}
        </section>

        <Alert>{error}</Alert>
        <div className="row end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={saving} disabled={!!clash || streamingField !== null}>
            {t(isNew ? 'editor.saveNew' : 'common.saveChanges')}
          </Button>
        </div>
      </form>

      <Modal
        open={confirm}
        title={t('editor.confirmTitle')}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="muted">{t('editor.confirmText')}</p>
      </Modal>
    </div>
  )
}
