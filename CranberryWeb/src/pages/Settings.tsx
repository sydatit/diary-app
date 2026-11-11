import { useState, type FormEvent } from 'react'
import { Languages, LogOut, Monitor, Moon, Sun } from 'lucide-react'
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
import { errorText, useI18n, type LangPref, type TKey } from '../i18n'

export default function Settings() {
  const { profile, userId, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const { pref, setPref } = useTheme()
  const { t, pref: langPref, setPref: setLangPref } = useI18n()
  const [setup, setSetup] = useState<DetoxSetup>(() => ({
    detoxStartDate: normalizeDate(profile?.detoxStartDate) || toISODate(),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!profile || !userId) return null
  // Split around the name so it can be bold in any language's word order.
  const [confirmBefore, confirmAfter = ''] = t('settings.deleteConfirmText', { name: '\u0000' }).split('\u0000')

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await usersApi.update(userId!, setup)
      await refreshProfile()
      toast(t('settings.saved'))
    } catch (err) {
      setError(errorText(err, t, 'settings.saveFailed'))
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
      setError(errorText(err, t, 'settings.deleteFailed'))
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
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
            {t('common.signOut')}
          </Button>
        </div>
      </section>

      <section className="card appearance">
        <div className="grow">
          <h2>{t('settings.appearance')}</h2>
          <p className="muted small">{t('settings.appearanceHint')}</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label={t('settings.themeAria')}>
          {(
            [
              ['system', 'settings.system', Monitor],
              ['light', 'settings.light', Sun],
              ['dark', 'settings.dark', Moon],
            ] as [ThemePref, TKey, typeof Sun][]
          ).map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={pref === v} className={pref === v ? 'active' : ''} onClick={() => setPref(v)}>
              <Icon size={14} />
              {t(label)}
            </button>
          ))}
        </div>
      </section>

      <section className="card appearance">
        <div className="grow">
          <h2>{t('settings.language')}</h2>
          <p className="muted small">{t('settings.languageHint')}</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
          {(
            [
              // Language names stay in their own language so they're findable whatever is selected.
              ['system', t('settings.auto')],
              ['en', 'English'],
              ['vi', 'Tiếng Việt'],
            ] as [LangPref, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={langPref === v}
              className={langPref === v ? 'active' : ''}
              onClick={() => setLangPref(v)}
              lang={v === 'system' ? undefined : v}
            >
              {v === 'system' && <Languages size={14} />}
              {label}
            </button>
          ))}
        </div>
      </section>

      <form className="card stack" onSubmit={save}>
        <div>
          <h2>{t('settings.detox')}</h2>
          <p className="muted small">{t('settings.detoxHint')}</p>
        </div>
        <Alert>{error}</Alert>
        <DetoxFields value={setup} onChange={setSetup} />
        <div className="row end">
          <Button type="submit" loading={saving}>
            {t('common.saveChanges')}
          </Button>
        </div>
      </form>

      <section className="card danger-zone">
        <div className="grow">
          <h2>{t('settings.deleteTitle')}</h2>
          <p className="muted small">{t('settings.deleteHint')}</p>
        </div>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          {t('settings.deleteTitle')}
        </Button>
      </section>

      <Modal
        open={confirmOpen}
        title={t('settings.deleteConfirmTitle')}
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" disabled={confirmText !== profile.userName} loading={deleting} onClick={deleteAccount}>
              {t('settings.deleteForever')}
            </Button>
          </>
        }
      >
        <p className="muted">
          {confirmBefore}
          <strong>{profile.userName}</strong>
          {confirmAfter}
        </p>
        <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
      </Modal>
    </div>
  )
}
