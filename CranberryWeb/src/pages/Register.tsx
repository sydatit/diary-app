import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { usersApi } from '../api/users'
import { Field } from '../components/Field'
import { Button } from '../components/Button'
import { Alert } from '../components/Alert'
import { DetoxFields } from '../components/DetoxFields'
import { AuthLayout } from './AuthLayout'
import { errorText, useI18n, type TKey } from '../i18n'
import { toISODate } from '../lib/date'
import type { DetoxSetup } from '../types'

const PASSWORD_RULES: [RegExp, TKey][] = [
  [/.{6,}/, 'register.rule.length'],
  [/[A-Z]/, 'register.rule.upper'],
  [/[a-z]/, 'register.rule.lower'],
  [/\d/, 'register.rule.number'],
  [/[^A-Za-z0-9]/, 'register.rule.symbol'],
]

export default function Register() {
  const navigate = useNavigate()
  const { t } = useI18n()
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
      setError(t('register.badUsername'))
      return
    }
    if (rules.some((r) => !r.ok)) {
      setError(t('register.weakPassword'))
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
      setError(errorText(err, t, 'register.failed'))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t(step === 1 ? 'register.title1' : 'register.title2')}
      subtitle={t(step === 1 ? 'register.subtitle1' : 'register.subtitle2')}
      footer={
        <>
          {t('register.haveAccount')} <Link to="/signin">{t('register.signIn')}</Link>
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
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            hint={t('register.emailHint')}
          />
          <Field label={t('auth.username')} autoComplete="username" required value={userName} onChange={(e) => setUserName(e.target.value)} />
          <Field
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={
              <span className="rules">
                {rules.map((r) => (
                  <span key={r.label} className={r.ok ? 'ok' : ''}>
                    {t(r.label)}
                  </span>
                ))}
              </span>
            }
          />
          <Button type="submit" block>
            {t('register.continue')}
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} className="stack">
          <Alert>{error}</Alert>
          <DetoxFields value={setup} onChange={setSetup} />
          <div className="row">
            <Button type="button" variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => setStep(1)} disabled={busy}>
              {t('common.back')}
            </Button>
            <Button type="submit" loading={busy} className="grow">
              {t('register.create')}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
