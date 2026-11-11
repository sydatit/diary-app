import { useState, type FormEvent } from 'react'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePref } from '../lib/theme'
import { useAuth } from '../auth/AuthContext'
import { usersApi } from '../api/users'
import { DetoxFields } from '../components/DetoxFields'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { useToast } from '../components/Toast'
import { normalizeDate, toISODate } from '../lib/date'
import type { DetoxSetup } from '../types'

export default function Settings() {
  const { profile, userId, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const { pref, setPref } = useTheme()
  const [setup, setSetup] = useState<DetoxSetup>(() => ({
    detoxStartDate: normalizeDate(profile?.detoxStartDate) || toISODate(),
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
      await usersApi.update(userId!, setup)
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
            <p className="muted small">{profile.email}</p>
          </div>
          <Button variant="secondary" icon={<LogOut size={16} />} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>

      <section className="card appearance">
        <div className="grow">
          <h2>Appearance</h2>
          <p className="muted small">Dark mode is easier on the eyes at night. System follows your device.</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {(
            [
              ['system', 'System', Monitor],
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
            ] as [ThemePref, string, typeof Sun][]
          ).map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={pref === v} className={pref === v ? 'active' : ''} onClick={() => setPref(v)}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <form className="card stack" onSubmit={save}>
        <div>
          <h2>Detox setup</h2>
          <p className="muted small">Used to count your days of unplugging.</p>
        </div>
        <Alert>{error}</Alert>
        <DetoxFields value={setup} onChange={setSetup} />
        <div className="row end">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>

      <section className="card danger-zone">
        <div className="grow">
          <h2>Delete account</h2>
          <p className="muted small">Permanently remove your account and all reflections.</p>
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
