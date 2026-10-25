import TeamManagement from '../components/TeamManagement'
import { useEffect, useState, type FormEvent } from 'react'
import { readableError } from '../../lib/supabase'
import { dateTime, initials } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, ImageUploader, PageHeader, Spinner } from '../components/ui'

export default function Profile() {
  const { profile, user, updateProfile, manageAccount } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', avatar_url: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        avatar_url: profile.avatar_url ?? '',
      })
    }
  }, [profile])


  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        avatar_url: form.avatar_url || null,
      })
      toast.success('Profile saved.')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setSaving(false)
    }
  }


  return (
    <>
    <form onSubmit={save}>
      <PageHeader
        title="Admin Profile"
        subtitle="Manage your personal details and account security."
        actions={
          <button type="submit" className="btn" disabled={saving}>
            {saving ? <Spinner label="Saving" /> : 'Save Changes'}
          </button>
        }
      />

      <div className="two">
        <div className="card pad">
          <h2 className="smalltitle">Personal Information</h2>
          <div className="hstack" style={{ gap: 24, padding: '15px 0 30px', flexWrap: 'wrap' }}>
            <div className="profile-big">
              {form.avatar_url ? <img src={form.avatar_url} alt="" /> : initials(form.first_name, form.last_name, profile?.email)}
            </div>
            <div>
              <h2>{`${form.first_name} ${form.last_name}`.trim() || 'Store Administrator'}</h2>
              <p className="sub">{profile?.email}</p>
              <div className="hstack" style={{ marginTop: 13 }}>
                <ImageUploader
                  folder={`avatars/${user?.id}`}
                  label="Change Photo"
                  className="btn soft sm"
                  onError={(m) => toast.error(m)}
                  onUploaded={([url]) => setForm((f) => ({ ...f, avatar_url: url }))}
                />
                {form.avatar_url && (
                  <button type="button" className="action danger" onClick={() => setForm((f) => ({ ...f, avatar_url: '' }))}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="formgrid">
            <Field label="First Name">
              <input className="input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </Field>
            <Field label="Last Name">
              <input className="input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </Field>
            <Field label="Email Address" hint="Changing the sign-in email is not available from this screen.">
              <input className="input" value={profile?.email ?? ''} disabled />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
          </div>
          <p className="tiny">Last signed in {dateTime(user?.last_sign_in_at ?? null)}</p>
        </div>

        <div>
          <div className="card pad">
            <h2 className="smalltitle">Security</h2>
            <p className="sub" style={{marginBottom:20}}>Manage your password, email, MFA and connected accounts in your secure account settings.</p>
            <button type="button" className="btn soft" onClick={manageAccount}>Manage Account Security</button>
          </div>

          <div className="notice" style={{ marginTop: 18 }}>
            🔒 Keep your account secure. Review your sign-in methods and enable two-step verification in Account Security.
          </div>
        </div>
      </div>
    </form>
    <TeamManagement />
    </>
  )
}
