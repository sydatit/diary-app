import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usersApi } from '../api/users'
import { HabitsFields } from '../components/HabitsFields'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { useToast } from '../components/Toast'
import { normalizeDate, toISODate } from '../lib/date'
import type { Habits } from '../types'

export default function Settings() {
  const { profile, userId, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const [habits, setHabits] = useState<Habits>(() => ({
    quitDate: normalizeDate(profile?.quitDate) || toISODate(),
    avgSmokedDaily: profile?.avgSmokedDaily ?? 0,
    pricePerPack: profile?.pricePerPack ?? 0,
    cigsPerPack: profile?.cigsPerPack ?? 0,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!profile || !userId) return null

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await usersApi.update(userId!, habits)
      await refreshProfile()
      toast('Settings saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await usersApi.remove(userId!)
      signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.')
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="card">
        <div className="profile-row">
          <span className="avatar lg">{profile.userName[0]?.toUpperCase()}</span>
          <div className="grow">
            <strong>{profile.userName}</strong>
            <p className="muted small">Signed in</p>
          </div>
          <Button variant="secondary" icon={<LogOut size={16} />} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>

      <form className="card stack" onSubmit={save}>
        <div>
          <h2>Smoking habits</h2>
          <p className="muted small">Used to calculate money saved and cigarettes avoided.</p>
        </div>
        <Alert>{error}</Alert>
        <HabitsFields value={habits} onChange={setHabits} />
        <div className="row end">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>

      <section className="card danger-zone">
        <div className="grow">
          <h2>Delete account</h2>
          <p className="muted small">Permanently remove your account and all journal entries.</p>
        </div>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Delete account
        </Button>
      </section>

      <Modal
        open={confirmOpen}
        title="Delete your account?"
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={confirmText !== profile.userName} loading={deleting} onClick={deleteAccount}>
              Delete forever
            </Button>
          </>
        }
      >
        <p className="muted">
          This permanently deletes your account and journal. Type <strong>{profile.userName}</strong> to confirm.
        </p>
        <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
      </Modal>
    </div>
  )
}
