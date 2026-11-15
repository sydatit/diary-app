import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal stand-in for the browser's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start() {
    this.started = true
  }
  stop() {
    setTimeout(() => this.onend?.(), 0)
  }
  abort() {}
  /** Simulate results for this session: [text, isFinal][] */
  say(...results: [string, boolean][]) {
    const list = results.map(([t, isFinal]) => Object.assign([{ transcript: t }], { isFinal }))
    this.onresult?.({ resultIndex: 0, results: list })
  }
  end() {
    this.onend?.()
  }
}

const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]

async function load() {
  vi.resetModules() // `broken` is module state
  return import('./speech')
}

describe('startLiveTranscript', () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition
  })
  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  })

  it('streams interim and final text, then stop() resolves with the transcript', async () => {
    const { startLiveTranscript } = await load()
    const onText = vi.fn()
    const live = startLiveTranscript({ lang: 'vi-VN', onText, onError: vi.fn() })

    latest().say(['hôm nay', false])
    expect(onText).toHaveBeenLastCalledWith('hôm nay')
    latest().say(['hôm nay trời đẹp', true])

    await expect(live.stop()).resolves.toBe('hôm nay trời đẹp')
    expect(latest().lang).toBe('vi-VN')
  })

  it('keeps listening across the service stopping by itself, keeping earlier words', async () => {
    const { startLiveTranscript } = await load()
    const onText = vi.fn()
    const live = startLiveTranscript({ lang: 'vi-VN', onText, onError: vi.fn() })

    latest().say(['một', true])
    latest().end() // silence timeout: restarts with a new session
    expect(FakeRecognition.instances).toHaveLength(2)
    latest().say(['hai', true])
    expect(onText).toHaveBeenLastCalledWith('một hai')

    await expect(live.stop()).resolves.toBe('một hai')
  })

  it('reports giving up after repeated silent restarts instead of going quiet (regression)', async () => {
    const { startLiveTranscript } = await load()
    const onError = vi.fn()
    startLiveTranscript({ lang: 'vi-VN', onText: vi.fn(), onError })

    latest().say(['xin chào', true])
    latest().end() // heard something: counter resets
    for (let i = 0; i < 6; i++) latest().end() // nothing heard, again and again

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('ended', 'xin chào')
  })

  it('reports a restart that throws instead of going quiet (regression)', async () => {
    const { startLiveTranscript } = await load()
    const onError = vi.fn()
    startLiveTranscript({ lang: 'vi-VN', onText: vi.fn(), onError })
    vi.spyOn(FakeRecognition.prototype, 'start').mockImplementation(() => {
      throw new Error('InvalidStateError')
    })

    latest().end()

    expect(onError).toHaveBeenCalledWith('ended', '')
  })

  it('reports a denied microphone', async () => {
    const { startLiveTranscript } = await load()
    const onError = vi.fn()
    startLiveTranscript({ lang: 'vi-VN', onText: vi.fn(), onError })
    latest().onerror?.({ error: 'not-allowed' })
    expect(onError).toHaveBeenCalledWith('denied', '')
  })

  it('marks the service broken on a network error so the next recording uploads audio', async () => {
    const { startLiveTranscript, isSpeechSupported } = await load()
    const onError = vi.fn()
    startLiveTranscript({ lang: 'vi-VN', onText: vi.fn(), onError })
    latest().onerror?.({ error: 'network' })
    expect(onError).toHaveBeenCalledWith('unavailable', '')
    expect(isSpeechSupported()).toBe(false)
  })

  it('stop() does not hang when the browser never fires end', async () => {
    vi.useFakeTimers()
    const { startLiveTranscript } = await load()
    const live = startLiveTranscript({ lang: 'vi-VN', onText: vi.fn(), onError: vi.fn() })
    latest().say(['còn dở', false])
    vi.spyOn(latest(), 'stop').mockImplementation(() => {})

    const done = live.stop()
    await vi.advanceTimersByTimeAsync(5000)
    await expect(done).resolves.toBe('còn dở')
  })

  it('speechLang maps the UI language', async () => {
    const { speechLang } = await load()
    expect(speechLang('vi')).toBe('vi-VN')
    expect(speechLang('en')).toBe('en-US')
  })
})
