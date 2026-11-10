import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, Square } from 'lucide-react'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { Alert } from './Alert'
import { diaryApi } from '../api/diary'
import { ApiError } from '../api/client'

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

function micErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      return 'Bạn đã từ chối quyền micro. Hãy cho phép micro trong cài đặt trình duyệt rồi thử lại.'
    if (err.name === 'NotFoundError') return 'Không tìm thấy micro trên thiết bị này.'
    if (err.name === 'NotReadableError') return 'Micro đang được ứng dụng khác sử dụng.'
  }
  return 'Không thể bật micro. Vui lòng thử lại.'
}

export function VoiceRecorder({ onSummary }: { onSummary: (text: string) => void }) {
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
    if (!supported) return fail('Trình duyệt này không hỗ trợ ghi âm. Hãy dùng Chrome, Edge, Firefox hoặc Safari mới.')
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      return fail(micErrorMessage(err))
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
      return fail('Trình duyệt không ghi âm được định dạng được hỗ trợ.')
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
    if (blob.size === 0) return fail('Không thu được âm thanh. Bạn thử ghi âm lại nhé.')
    setStatus('processing')
    try {
      const summary = await diaryApi.voiceToDiary(blob)
      if (unmountedRef.current) return
      onSummaryRef.current(summary)
      setStatus('idle')
    } catch (err) {
      if (unmountedRef.current) return
      fail(err instanceof ApiError || err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.')
    }
  }

  return (
    <div className="voice-recorder">
      {status === 'idle' && (
        <div className="voice-row">
          <Button type="button" variant="secondary" icon={<Mic size={16} />} onClick={start}>
            Bắt đầu ghi âm
          </Button>
          <span className="muted small">Kể về ngày của bạn, AI sẽ viết thành các dòng nhật ký.</span>
        </div>
      )}

      {status === 'recording' && (
        <div className="voice-row">
          <span className="rec-indicator" aria-live="polite">
            <span className="rec-dot" aria-hidden />
            <span className="rec-timer">{formatTime(seconds)}</span>
          </span>
          <Button type="button" variant="danger" icon={<Square size={14} />} onClick={stop}>
            Dừng &amp; Tóm tắt
          </Button>
        </div>
      )}

      {status === 'processing' && (
        <div className="voice-row" aria-live="polite">
          <Spinner size={16} />
          <span className="muted">AI đang nghe và viết nhật ký...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="voice-error">
          <Alert>{error}</Alert>
          <Button type="button" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setStatus('idle')}>
            Thử lại
          </Button>
        </div>
      )}
    </div>
  )
}
