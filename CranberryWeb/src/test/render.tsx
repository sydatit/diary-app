import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import { AuthProvider } from '../auth/AuthContext'
import { ToastProvider } from '../components/Toast'
import { session } from '../api/client'
import { ThemeProvider } from '../lib/theme'

/** A JWT the client can read (it never checks the signature). */
export function fakeToken(expiresInSec = 3600): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256' })}.${b64({ userId: 'u1', exp: Math.floor(Date.now() / 1000) + expiresInSec })}.sig`
}

export function signedIn(userId = 'u1', expiresInSec = 3600) {
  session.save(fakeToken(expiresInSec), userId)
}

/** Shows the current path so tests can assert on navigation. */
export function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

interface Options {
  route?: string
  state?: unknown
  /** Route pattern the element is mounted at, e.g. "/journal/:id". */
  path?: string
  extraRoutes?: ReactNode
}

/** Render inside the app's providers and a memory router. */
export function renderApp(ui: ReactElement, { route = '/', state, path = '*', extraRoutes }: Options = {}) {
  return render(
    <ThemeProvider>
    <LanguageProvider>
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path={path} element={ui} />
              {extraRoutes}
            </Routes>
            <LocationProbe />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </LanguageProvider>
    </ThemeProvider>,
  )
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
