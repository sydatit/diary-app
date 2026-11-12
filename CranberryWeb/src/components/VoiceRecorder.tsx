import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, Square, X } from 'lucide-react'
import { Spinner } from './Spinner'
import { diaryApi, type DiarySection } from '../api/diary'
import { errorText, useI18n, type TKey } from '../i18n'

type Status = 'idle' | 'recording' | 'processing' | 'error'

/** ~10 min of opus/aac stays well under the API's 20MB limit. */
const MAX_SECONDS = 600

/**
 * Loudest 100ms (RMS, 0..1) must reach this, or the clip is treated as silence and not sent:
 * Gemini makes up a whole diary entry for a silent clip. Speech is ~0.05-0.3, a quiet room ~0.001-0.005.
 */
const SPEECH_RMS = 0.01

/** Tracks the loudest moment of a stream. `heard()` is null if the meter couldn't run (then don't block). */
function startLevelMeter(stream: MediaStream) {
  let ctx: AudioContext | null = null
  let timer: number | null = null
  let peak = 0
  let measured = false
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctx) {
      ctx = new Ctx()
      void ctx.resume().catch(() => {})
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      timer = window.setInterval(() => {
        if (ctx?.state !== 'running') return // a suspended context reads zeros; don't count those
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += v * v
        peak = Math.max(peak, Math.sqrt(sum / buf.length))
        measured = true
      }, 100)
    }
  } catch {
    ctx = null
  }
  return {
    heard: (): boolean | null => (measured ? peak >= SPEECH_RMS : null),
    stop() {
      if (timer !== null) window.clearInterval(timer)
      void ctx?.close().catch(() => {})
    },
  }
}

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
  /** Final AI text, once it is complete. */
  onSummary: (text: string) => void
  /** The AI text so far, while it is still being written (each call has the whole text, not a piece). */
  onPartial?: (soFar: string) => void
  /** Streaming failed after `onPartial` was called: drop the partial text. */
  onAbort?: () => void
  /** Another field is recording, so this mic is locked. */
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
}

/** Round mic button meant to sit inside a textarea (see AutoTextarea `addon`). */
export function VoiceRecorder({ section, onSummary, onPartial, onAbort, disabled, onBusyChange }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const meterRef = useRef<ReturnType<typeof startLevelMeter> | null>(null)
  const unmountedRef = useRef(false)
  // Keep the latest callback without re-creating the recorder handlers.
  const onSummaryRef = useRef(onSummary)
  onSummaryRef.current = onSummary
  const onBusyRef = useRef(onBusyChange)
  onBusyRef.current = onBusyChange
  const onPartialRef = useRef(onPartial)
  onPartialRef.current = onPartial
  const onAbortRef = useRef(onAbort)
  onAbortRef.current = onAbort

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
    meterRef.current?.stop()
    meterRef.current = null
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
      const heard = meterRef.current?.heard() ?? null
      cleanup()
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
      chunksRef.current = []
      if (heard === false) return fail(t('voice.noSpeech')) // nothing above room noise: don't send it
      void submit(blob)
    }

    meterRef.current = startLevelMeter(stream)
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
    let streamed = false
    try {
      // Stream so the text starts appearing in the box within a second or two instead of all at the end.
      const summary = await diaryApi.voiceToDiaryStream(blob, section, (soFar) => {
        if (unmountedRef.current) return
        streamed = true
        onPartialRef.current?.(soFar)
      })
      if (unmountedRef.current) return
      onSummaryRef.current(summary)
      setStatus('idle')
    } catch (err) {
      if (unmountedRef.current) return
      if (streamed) onAbortRef.current?.()
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
