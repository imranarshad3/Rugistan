import {ArrowUpRight,Check,Clock3,Mail,ShieldCheck,UserRound} from 'lucide-react'
import {roleLabel} from '../../lib/teamAccess'
import TeamManagement from '../components/TeamManagement'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { readableError } from '../../lib/supabase'
import { dateTime, initials } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, ImageUploader, PageHeader, Spinner } from '../components/ui'

export default function Profile() {
  const { profile, user, teamRole, isAdmin, updateProfile, manageAccount } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', avatar_url: '' })
  const [saving, setSaving] = useState(false)
  const busy=useRef(false)
  const role=teamRole??(isAdmin?'owner':'admin')
  const dirty=!!profile&&(form.first_name!==profile.first_name||form.last_name!==profile.last_name||form.phone!==profile.phone||form.avatar_url!==(profile.avatar_url??''))

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
    if(busy.current||!dirty)return
    busy.current=true
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
      busy.current=false
      setSaving(false)
    }
  }


  return (
    <section className="profile-page" aria-label="Studio profile">
    <form onSubmit={save}>
      <PageHeader title="Your Profile" subtitle="Your place in the studio. Personal details, account security and your team." actions={<button type="submit" className="btn" disabled={saving||!dirty}>{saving?<Spinner label="Saving"/>:<><Check size={16} aria-hidden="true"/> Save Changes</>}</button>}/>
      <div className="profile-identity card">
        <div className="profile-avatar"><span aria-hidden="true">{initials(form.first_name,form.last_name,profile?.email)}</span>{form.avatar_url&&<img src={form.avatar_url} alt="Your profile" onLoad={e=>{e.currentTarget.style.visibility='visible'}} onError={e=>{e.currentTarget.style.visibility='hidden'}}/>}</div>
        <div className="profile-identity-copy"><span className="profile-role"><ShieldCheck size={13} aria-hidden="true"/>{roleLabel(role)}</span><h2>{`${form.first_name} ${form.last_name}`.trim()||'Welcome to your studio'}</h2><p><Mail size={14} aria-hidden="true"/>{profile?.email}</p><div className="profile-photo-actions"><ImageUploader folder={`avatars/${user?.id}`} label="Change Photo" className="btn soft sm" onError={m=>toast.error(m)} onUploaded={([url])=>setForm(f=>({...f,avatar_url:url}))}/>{form.avatar_url&&<button type="button" className="action" disabled={saving} onClick={()=>setForm(f=>({...f,avatar_url:''}))}>Remove photo</button>}</div></div>
        <div className="profile-session"><Clock3 size={17} aria-hidden="true"/><div><span>LAST SIGNED IN</span><strong>{dateTime(user?.last_sign_in_at??null)}</strong></div></div>
      </div>
      <div className="profile-details-layout">
        <div className="card pad profile-personal">
          <div className="profile-card-title"><span className="profile-section-icon"><UserRound size={19} aria-hidden="true"/></span><div><h2>Personal details</h2><p>Make yourself at home in the studio.</p></div></div>
          <fieldset disabled={saving} className="profile-fields"><div className="formgrid">
            <Field label="First Name"><input className="input" autoComplete="given-name" maxLength={64} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))}/></Field>
            <Field label="Last Name"><input className="input" autoComplete="family-name" maxLength={64} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))}/></Field>
            <div className="profile-email-field"><Field label="Email Address" hint="Your sign-in email is managed in Account Security."><input className="input" type="email" autoComplete="email" value={profile?.email??''} readOnly/></Field></div>
            <div className="profile-phone-field"><Field label="Phone" hint="Include your country code, if applicable."><input className="input" type="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></Field></div>
          </div></fieldset>
          <div className="profile-save-status" role="status">{saving?'Saving your details…':dirty?'You have unsaved changes.':'Your profile is up to date.'}</div>
        </div>
        <aside className="profile-security card pad" aria-labelledby="profile-security-title"><span className="profile-security-icon"><ShieldCheck size={26} aria-hidden="true"/></span><span className="eyebrow">ACCOUNT & SIGN-IN</span><h2 id="profile-security-title">A little peace of mind.</h2><p>Manage your password, email, two-step verification and connected accounts in one place.</p><button type="button" className="btn" onClick={manageAccount}>Account Security <ArrowUpRight size={16} aria-hidden="true"/></button><div className="profile-security-note"><ShieldCheck size={16} aria-hidden="true"/><p>Review your sign-in methods regularly and enable two-step verification in your account settings.</p></div></aside>
      </div>
    </form>
    <TeamManagement/>
    </section>
  )
}
