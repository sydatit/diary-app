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
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
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
function extractMessage(body: unknown, status: number): string {
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
  if (status === 404) return 'Not found.'
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status >= 500) return 'The server ran into a problem. Please try again.'
  return 'Something went wrong.'
}

export async function api<T = void>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = session.token
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.')
  }

  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.()
    throw new ApiError(res.status, extractMessage(body, res.status), body)
  }
  return body as T
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
