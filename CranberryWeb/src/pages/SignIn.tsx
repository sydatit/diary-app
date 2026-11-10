import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { usersApi } from '../api/users'
import { Field } from '../components/Field'
import { Button } from '../components/Button'
import { Alert } from '../components/Alert'
import { AuthLayout } from './AuthLayout'

export default function SignIn() {
  const { signIn } = useAuth()
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
      setError(err instanceof Error && err.message !== 'Unable to sign in.' ? err.message : 'Incorrect email or password.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your journal."
      footer={
        <>
          New to Unplug? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} className="stack">
        <Alert>{error}</Alert>
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" block loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
