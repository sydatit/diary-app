import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usersApi } from '../api/users'
import { ApiError } from '../api/client'
import { Button } from '../components/Button'
import { Alert } from '../components/Alert'
import { AuthLayout } from './AuthLayout'

const LEN = 6
const COOLDOWN = 60

export default function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { completeSignIn } = useAuth()
  const state = location.state as { email?: string; sent?: boolean } | null
  const email = state?.email ?? ''

  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(state?.sent ? COOLDOWN : 0)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  if (!email) return <Navigate to="/signin" replace />

  const code = digits.join('')

  async function submit(value = code) {
    if (value.length !== LEN || busy) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await usersApi.verifyEmail(email, value)
      completeSignIn(res.token, res.userId)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AlreadyVerified') {
        navigate('/signin', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Verification failed.')
      if (err instanceof ApiError && err.code !== 'Invalid') setDigits(Array(LEN).fill(''))
      setBusy(false)
      inputs.current[0]?.focus()
    }
  }

  function setAt(i: number, v: string) {
    const d = v.replace(/\D/g, '')
    if (!d) {
      setDigits((prev) => prev.map((x, j) => (j === i ? '' : x)))
      return
    }
    // Typing (or autofill) of several digits fills forward.
    const next = [...digits]
    for (let k = 0; k < d.length && i + k < LEN; k++) next[i + k] = d[k]
    setDigits(next)
    const focus = Math.min(LEN - 1, i + d.length)
    inputs.current[focus]?.focus()
    if (next.every(Boolean)) submit(next.join(''))
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < LEN - 1) inputs.current[i + 1]?.focus()
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
    if (!d) return
    e.preventDefault()
    setAt(0, d)
  }

  async function resend() {
    setResending(true)
    setError(null)
    setInfo(null)
    try {
      await usersApi.resendCode(email)
      setInfo('A new code is on its way.')
      setDigits(Array(LEN).fill(''))
      setCooldown(COOLDOWN)
      inputs.current[0]?.focus()
    } catch (err) {
      const retry = err instanceof ApiError && err.body && typeof err.body === 'object' && 'retryAfter' in err.body
        ? Number((err.body as { retryAfter: number }).retryAfter)
        : 0
      if (retry) setCooldown(retry)
      setError(err instanceof Error ? err.message : 'Could not resend the code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle=""
      footer={
        <>
          Wrong email? <Link to="/register">Start over</Link>
        </>
      }
    >
      <div className="verify-intro">
        <span className="verify-icon">
          <MailCheck size={22} />
        </span>
        <p className="muted">
          We sent a 6-digit code to <strong className="text">{email}</strong>. Enter it below to activate your account. It expires in 15
          minutes.
        </p>
      </div>
      <form
        className="stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          submit()
        }}
      >
        <Alert>{error}</Alert>
        {info && <p className="info">{info}</p>}
        <div className="otp">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? LEN : 1}
              aria-label={`Digit ${i + 1}`}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              onFocus={(e) => e.target.select()}
              disabled={busy}
            />
          ))}
        </div>
        <Button type="submit" block loading={busy} disabled={code.length !== LEN}>
          Verify & continue
        </Button>
        <p className="resend">
          Didn't get it? Check spam, or{' '}
          <button type="button" className="link-btn" onClick={resend} disabled={cooldown > 0 || resending}>
            {cooldown > 0 ? `resend in ${cooldown}s` : resending ? 'sending…' : 'resend code'}
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
