import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { usersApi } from '../api/users'
import { Field } from '../components/Field'
import { Button } from '../components/Button'
import { Alert } from '../components/Alert'
import { AuthLayout } from './AuthLayout'
import { errorText, useI18n } from '../i18n'

export default function SignIn() {
  const { signIn } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/signin' ? from : '/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EmailNotConfirmed') {
        // Password was right but the account isn't active yet: send a fresh code and go verify.
        await usersApi.resendCode(email.trim()).catch(() => {})
        navigate('/verify', { state: { email: email.trim(), sent: true } })
        return
      }
      setError(err instanceof Error && err.message !== 'Unable to sign in.' ? errorText(err, t) : t('signin.incorrect'))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('signin.title')}
      subtitle={t('signin.subtitle')}
      footer={
        <>
          {t('signin.newHere')} <Link to="/register">{t('signin.createAccount')}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="stack">
        <Alert>{error}</Alert>
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" block loading={busy}>
          {t('signin.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
