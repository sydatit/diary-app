const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'unplug.token'
const USER_KEY = 'unplug.userId'

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY)
  },
  get userId() {
    return localStorage.getItem(USER_KEY)
  },
  save(token: string, userId: string) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, userId)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export class ApiError extends Error {
  status: number
  /** Machine-readable code from the API, e.g. "EmailNotConfirmed", "Expired". */
  code?: string
  body: unknown
  /** Translation key when the message was made up on the client (no server message to show). */
  key?: string
  constructor(status: number, message: string, body?: unknown, key?: string) {
    super(message)
    this.status = status
    this.body = body
    this.key = key
    if (body && typeof body === 'object' && 'code' in body && typeof (body as { code: unknown }).code === 'string') {
      this.code = (body as { code: string }).code
    }
  }
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

/** Turn the various error shapes the API returns into one readable message. */
function extractMessage(body: unknown): string {
  if (Array.isArray(body)) {
    // ASP.NET Identity errors: [{ code, description }]
    const msgs = body.map((e) => (e && typeof e === 'object' && 'description' in e ? String(e.description) : '')).filter(Boolean)
    if (msgs.length) return msgs.join(' ')
  }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b.message === 'string') return b.message
    // ModelState validation errors: { errors: { Field: ["..."] } }
    if (b.errors && typeof b.errors === 'object') {
      const msgs = Object.values(b.errors as Record<string, string[]>).flat()
      if (msgs.length) return msgs.join(' ')
    }
    if (typeof b.title === 'string') return b.title
  }
  return ''
}

/** Client-side fallback (English text + translation key) when the server gave no message. */
function fallbackError(status: number): [string, string] {
  if (status === 404) return ['Not found.', 'error.notFound']
  if (status === 401) return ['Your session has expired. Please sign in again.', 'error.session']
  if (status >= 500) return ['The server ran into a problem. Please try again.', 'error.server']
  return ['Something went wrong.', 'error.generic']
}

function authHeaders(json: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
  const token = session.token
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function send(path: string, method: string, body: unknown, accept?: string): Promise<Response> {
  // FormData goes as-is: the browser sets multipart Content-Type with its boundary.
  const isForm = body instanceof FormData
  const headers = authHeaders(body !== undefined && !isForm)
  if (accept) headers.Accept = accept
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.', undefined, 'error.network')
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toError(res: Response, body: unknown): ApiError {
  if (res.status === 401 && session.token) onUnauthorized?.()
  const message = extractMessage(body)
  if (message) return new ApiError(res.status, message, body)
  const [text, key] = fallbackError(res.status)
  return new ApiError(res.status, text, body, key)
}

export async function api<T = void>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await send(path, options.method ?? 'GET', options.body)
  const body = await readBody(res)
  if (!res.ok) throw toError(res, body)
  return body as T
}

/**
 * POST and read a Server-Sent Events reply, calling `onEvent` for each event as it arrives.
 * A non-2xx reply (sent before streaming starts) throws an ApiError like `api()`.
 */
export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const res = await send(path, 'POST', body, 'text/event-stream')
  if (!res.ok) throw toError(res, await readBody(res))
  if (!res.body) throw new ApiError(0, 'Streaming is not supported in this browser.', undefined, 'error.generic')

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  const flush = (frame: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    }
    if (!data.length) return
    let parsed: unknown = data.join('\n')
    try {
      parsed = JSON.parse(parsed as string)
    } catch {
      /* plain text payload */
    }
    onEvent(event, parsed)
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value.replace(/\r\n?/g, '\n')
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        flush(buf.slice(0, i))
        buf = buf.slice(i + 2)
      }
    }
  } catch (err) {
    reader.cancel().catch(() => {})
    if (err instanceof ApiError) throw err
    throw new ApiError(0, 'Cannot reach the server. Check your connection.', undefined, 'error.network')
  }
  if (buf.trim()) flush(buf)
}

/** Read the `exp` claim (seconds) from a JWT without verifying it. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}
