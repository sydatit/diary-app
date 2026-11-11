import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { usersApi } from '../api/users'
import { Field } from '../components/Field'
import { Button } from '../components/Button'
import { Alert } from '../components/Alert'
import { DetoxFields } from '../components/DetoxFields'
import { AuthLayout } from './AuthLayout'
import { toISODate } from '../lib/date'
import type { DetoxSetup } from '../types'

const PASSWORD_RULES: [RegExp, string][] = [
  [/.{6,}/, '6+ characters'],
  [/[A-Z]/, 'uppercase'],
  [/[a-z]/, 'lowercase'],
  [/\d/, 'number'],
  [/[^A-Za-z0-9]/, 'symbol'],
]

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [setup, setSetup] = useState<DetoxSetup>({ detoxStartDate: toISODate() })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rules = PASSWORD_RULES.map(([re, label]) => ({ label, ok: re.test(password) }))

  function next(e: FormEvent) {
    e.preventDefault()
    if (!/^[A-Za-z0-9._@+-]+$/.test(userName)) {
      setError('Username can only contain letters, numbers and . _ @ + -')
      return
    }
    if (rules.some((r) => !r.ok)) {
      setError('Please choose a stronger password.')
      return
    }
    setError(null)
    setStep(2)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await usersApi.register({ email: email.trim(), userName: userName.trim(), password, ...setup })
      navigate('/verify', { state: { email: email.trim(), sent: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={step === 1 ? 'Create your account' : 'Set your starting point'}
      subtitle={step === 1 ? 'Step 1 of 2 · The basics' : 'Step 2 of 2 · So we can show your progress'}
      footer={
        <>
          Already have an account? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      <div className="progress-dots">
        <i className="on" />
        <i className={step === 2 ? 'on' : ''} />
      </div>
      {step === 1 ? (
        <form onSubmit={next} className="stack">
          <Alert>{error}</Alert>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            hint="We'll send a 6-digit code here to activate your account."
          />
          <Field label="Username" autoComplete="username" required value={userName} onChange={(e) => setUserName(e.target.value)} />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={
              <span className="rules">
                {rules.map((r) => (
                  <span key={r.label} className={r.ok ? 'ok' : ''}>
                    {r.label}
                  </span>
                ))}
              </span>
            }
          />
          <Button type="submit" block>
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} className="stack">
          <Alert>{error}</Alert>
          <DetoxFields value={setup} onChange={setSetup} />
          <div className="row">
            <Button type="button" variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" loading={busy} className="grow">
              Create account
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
