import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, apiStream, session, setUnauthorizedHandler, tokenExpiry } from './client'
import { fakeToken, jsonResponse } from '../test/render'

function sseResponse(chunks: string[], status = 200): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch))
      c.close()
    },
  })
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('tokenExpiry', () => {
  it('reads exp in milliseconds', () => {
    const token = fakeToken(60)
    const exp = tokenExpiry(token)!
    expect(exp).toBeGreaterThan(Date.now())
    expect(exp).toBeLessThanOrEqual(Date.now() + 60_000)
  })

  it('returns null for malformed tokens or a missing exp', () => {
    expect(tokenExpiry('garbage')).toBeNull()
    expect(tokenExpiry('a.%%%.c')).toBeNull()
    expect(tokenExpiry(`x.${btoa(JSON.stringify({ sub: 1 }))}.y`)).toBeNull()
  })
})

describe('api()', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('sends the bearer token and JSON body', async () => {
    session.save('tok', 'u1')
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await expect(api('/api/x', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('turns an API error body into an ApiError with message and code', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'Error', code: 'DuplicateDate', message: 'dup' }, 409))
    const err = await api('/api/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'DuplicateDate', message: 'dup' })
  })

  it('joins Identity and validation errors into one message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ code: 'A', description: 'One.' }, { code: 'B', description: 'Two.' }], 400))
    expect((await api('/x').catch((e) => e)).message).toBe('One. Two.')
    fetchMock.mockResolvedValueOnce(jsonResponse({ title: 'Bad', errors: { Mood: ['Mood is out of range.'] } }, 400))
    expect((await api('/x').catch((e) => e)).message).toBe('Mood is out of range.')
  })

  it('uses a translated fallback when the server gave no message', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }))
    expect(await api('/x').catch((e) => e)).toMatchObject({ status: 500, key: 'error.server' })
  })

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await api('/x').catch((e) => e)).toMatchObject({ status: 0, key: 'error.network' })
  })

  it('calls the unauthorized handler on 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    session.save('tok', 'u1')
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))
    await api('/x').catch(() => {})
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls the unauthorized handler on 401 even when the token is already gone (signed out in another tab)', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))
    await api('/x').catch(() => {})
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('apiStream()', () => {
  afterEach(() => vi.unstubAllGlobals())

  async function collect(chunks: string[]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(chunks)))
    const events: [string, unknown][] = []
    await apiStream('/s', {}, (e, d) => events.push([e, d]))
    return events
  }

  it('parses events split across chunks', async () => {
    expect(await collect(['data: {"text":"Hel', 'lo"}\n', '\ndata: {"text":" there"}\n\nevent: done\ndata: {}\n\n'])).toEqual([
      ['message', { text: 'Hello' }],
      ['message', { text: ' there' }],
      ['done', {}],
    ])
  })

  it('accepts CRLF line endings and a last frame without a blank line', async () => {
    expect(await collect(['data: {"text":"a"}\r\n\r\n', 'event: done\r\ndata: {}'])).toEqual([
      ['message', { text: 'a' }],
      ['done', {}],
    ])
  })

  it('joins multi-line data and keeps plain text payloads', async () => {
    expect(await collect(['data: line 1\ndata: line 2\n\n'])).toEqual([['message', 'line 1\nline 2']])
  })

  it('throws an ApiError for an error status before streaming', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'AI failed' }, 502)))
    await expect(apiStream('/s', {}, () => {})).rejects.toMatchObject({ status: 502, message: 'AI failed' })
  })
})
