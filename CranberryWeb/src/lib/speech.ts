// Live transcript from the browser's speech recognition (Web Speech API).
// Chrome/Edge/Safari have it (prefixed as webkitSpeechRecognition); Firefox does not.
// TS's DOM lib doesn't ship these types, so the bits we use are declared here.

interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  readonly isFinal: boolean
  readonly length: number
  [i: number]: SpeechAlternative
}
interface SpeechResultEvent extends Event {
  readonly resultIndex: number
  readonly results: { readonly length: number; [i: number]: SpeechResult }
}
interface SpeechErrorEvent extends Event {
  readonly error: string
}
interface Recognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Set once the speech service fails (offline, Siri dictation off, ...): use audio upload for the rest of the visit. */
let broken = false

export function isSpeechSupported(): boolean {
  return !broken && !!ctor()
}

/**
 * - `denied`: microphone permission refused.
 * - `unavailable`: the speech service can't be used here (network, Siri/dictation off, language, no mic).
 */
export type SpeechFailure = 'denied' | 'unavailable'

export interface LiveTranscript {
  /** Stop listening; resolves with the whole transcript once the last words are finalised. */
  stop(): Promise<string>
  /** Stop and throw everything away (unmount). */
  abort(): void
}

/** Restarting this often in a row with nothing heard means the service keeps dying: give up. */
const MAX_EMPTY_RESTARTS = 5

/**
 * Start listening. `onText` gets the full text so far after every change (finalised words + the current guess).
 * `onError` is called at most once; listening has stopped by then, and `text` is what was finalised before it.
 */
export function startLiveTranscript(opts: {
  lang: string
  onText: (text: string) => void
  onError: (kind: SpeechFailure, text: string) => void
}): LiveTranscript {
  const Ctor = ctor()
  if (!Ctor) throw new Error('Speech recognition is not supported')

  let finalText = '' // finalised across all sessions
  let sessionFinal = '' // finalised in the current session (results restart at 0 after a restart)
  let interim = ''
  let stopping = false
  let ended = false
  let emptyRestarts = 0
  let heardThisSession = false
  let rec: Recognition
  let resolveStop: ((text: string) => void) | null = null

  const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ')
  const fullFinal = () => join(finalText, sessionFinal)

  const finish = () => {
    ended = true
    resolveStop?.(fullFinal())
  }

  const begin = () => {
    rec = new Ctor()
    rec.lang = opts.lang
    rec.continuous = true
    rec.interimResults = true
    sessionFinal = ''
    heardThisSession = false

    rec.onresult = (e) => {
      // Rebuild this session's text from all results: Android Chrome re-sends earlier ones.
      let fin = ''
      let guess = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) fin = join(fin, r[0].transcript)
        else guess = join(guess, r[0].transcript)
      }
      sessionFinal = fin
      interim = guess
      if (fin || guess) heardThisSession = true
      opts.onText(join(fullFinal(), interim))
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return // onend restarts / finishes
      const kind: SpeechFailure = e.error === 'not-allowed' ? 'denied' : 'unavailable'
      if (kind === 'unavailable') broken = true
      stopping = true
      const text = fullFinal()
      rec.onend = null
      ended = true
      // Already stopping: hand back what we have through stop(); otherwise report the failure.
      if (resolveStop) resolveStop(text)
      else opts.onError(kind, text)
    }

    rec.onend = () => {
      // Keep the words from this session; a still-pending guess is promoted rather than lost.
      finalText = join(finalText, sessionFinal, interim)
      sessionFinal = ''
      interim = ''
      if (stopping) return finish()
      // The service stopped by itself (silence timeout, ~60s limit on Chrome): carry on listening.
      emptyRestarts = heardThisSession ? 0 : emptyRestarts + 1
      if (emptyRestarts > MAX_EMPTY_RESTARTS) {
        stopping = true
        return finish()
      }
      try {
        begin()
      } catch {
        stopping = true
        finish()
      }
    }

    rec.start()
  }

  begin()

  return {
    stop() {
      if (ended) return Promise.resolve(fullFinal())
      return new Promise<string>((resolve) => {
        resolveStop = resolve
        stopping = true
        rec.stop()
        // Some browsers never fire `end` after stop(); don't hang the UI on them.
        window.setTimeout(() => {
          if (!ended) {
            rec.onend = null
            rec.abort()
            finalText = join(finalText, sessionFinal, interim)
            sessionFinal = ''
            interim = ''
            finish()
          }
        }, 2500)
      })
    },
    abort() {
      stopping = true
      ended = true
      rec.onend = null
      rec.onerror = null
      rec.onresult = null
      rec.abort()
    },
  }
}

/** Recognition language for the UI language. */
export function speechLang(uiLang: string): string {
  return uiLang === 'en' ? 'en-US' : 'vi-VN'
}
