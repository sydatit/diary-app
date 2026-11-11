import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, Square, X } from 'lucide-react'
import { Spinner } from './Spinner'
import { diaryApi, type DiarySection } from '../api/diary'
import { errorText, useI18n, type TKey } from '../i18n'

type Status = 'idle' | 'recording' | 'processing' | 'error'

/** ~10 min of opus/aac stays well under the API's 20MB limit. */
const MAX_SECONDS = 600

/** Chrome/Edge/Firefox -> webm/opus, Safari/iOS -> mp4. */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function micErrorKey(err: unknown): TKey {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') return 'voice.micDenied'
    if (err.name === 'NotFoundError') return 'voice.micNotFound'
    if (err.name === 'NotReadableError') return 'voice.micBusy'
  }
  return 'voice.micFailed'
}

interface Props {
  /** Which journal prompt this recording is for; tells the AI what kind of lines to write. */
  section: DiarySection
  onSummary: (text: string) => void
  /** Another field is recording, so this mic is locked. */
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
}

/** Round mic button meant to sit inside a textarea (see AutoTextarea `addon`). */
export function VoiceRecorder({ section, onSummary, disabled, onBusyChange }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const unmountedRef = useRef(false)
  // Keep the latest callback without re-creating the recorder handlers.
  const onSummaryRef = useRef(onSummary)
  onSummaryRef.current = onSummary
  const onBusyRef = useRef(onBusyChange)
  onBusyRef.current = onBusyChange

  const busy = status === 'recording' || status === 'processing'
  useEffect(() => {
    onBusyRef.current?.(busy)
  }, [busy])
  useEffect(() => () => onBusyRef.current?.(false), [])

  const supported =
    typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  function cleanup() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop()) // turn the mic indicator off
    streamRef.current = null
  }

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.stop()
      }
      cleanup()
    }
  }, [])

  function fail(message: string) {
    cleanup()
    setError(message)
    setStatus('error')
  }

  async function start() {
    if (!supported) return fail(t('voice.unsupported'))
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      return fail(t(micErrorKey(err)))
    }
    if (unmountedRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    streamRef.current = stream

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      return fail(t('voice.formatUnsupported'))
    }
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      cleanup()
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
      chunksRef.current = []
      void submit(blob)
    }

    recorder.start(1000) // emit chunks every second so nothing is lost if the tab stalls
    setSeconds(0)
    setStatus('recording')
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
  }

  // Auto-stop at the length limit.
  useEffect(() => {
    if (status === 'recording' && seconds >= MAX_SECONDS) stop()
  }, [status, seconds])

  function stop() {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      setStatus('processing')
      rec.stop()
    }
  }

  async function submit(blob: Blob) {
    if (blob.size === 0) return fail(t('voice.empty'))
    setStatus('processing')
    try {
      const summary = await diaryApi.voiceToDiary(blob, section)
      if (unmountedRef.current) return
      onSummaryRef.current(summary)
      setStatus('idle')
    } catch (err) {
      if (unmountedRef.current) return
      fail(errorText(err, t, 'voice.failed'))
    }
  }

  return (
    <div className="voice-mic-wrap">
      {status === 'idle' && (
        <button
          type="button"
          className="voice-mic"
          onClick={start}
          disabled={disabled}
          aria-label={t('voice.record')}
          title={t('voice.record')}
        >
          <Mic size={18} />
        </button>
      )}

      {status === 'recording' && (
        <>
          <span className="rec-indicator" aria-live="polite">
            <span className="rec-dot" aria-hidden />
            <span className="rec-timer">{formatTime(seconds)}</span>
          </span>
          <button type="button" className="voice-mic recording" onClick={stop} aria-label={t('voice.stop')} title={t('voice.stop')}>
            <Square size={14} fill="currentColor" />
          </button>
        </>
      )}

      {status === 'processing' && (
        <span className="voice-mic processing" aria-live="polite" aria-label={t('voice.processing')} title={t('voice.processing')}>
          <Spinner size={16} />
        </span>
      )}

      {status === 'error' && (
        <>
          <div className="voice-error" role="alert">
            <span>{error}</span>
            <button type="button" className="voice-error-close" onClick={() => setStatus('idle')} aria-label={t('common.close')}>
              <X size={14} />
            </button>
          </div>
          <button type="button" className="voice-mic" onClick={start} disabled={disabled} aria-label={t('voice.retry')} title={t('voice.retry')}>
            <RotateCcw size={16} />
          </button>
        </>
      )}
    </div>
  )
}
