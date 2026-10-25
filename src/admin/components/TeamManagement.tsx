import {useCallback,useEffect,useId,useRef,useState,type FormEvent} from 'react'
import {MailPlus,ShieldCheck,SlidersHorizontal,Send,UserRound,X} from 'lucide-react'
import {teamRequest} from '../../lib/teamApi'
import {TEAM_ROLES,roleLabel,canAssignRole,type TeamRole,type TeamPermission} from '../../lib/teamAccess'
import {useAuth} from '../../context/AuthContext'
import {useToast} from '../../context/ToastContext'
import {dateTime,initials} from '../../lib/format'
import {ConfirmDialog,Field,Modal,Notice,Spinner} from './ui'
type Member={id:string;email:string;first_name:string;last_name:string;isAdmin:boolean;role:TeamRole;permissions:TeamPermission[]}
type Invitation={id:string;email:string;permissions:TeamPermission[];is_admin:boolean;role:TeamRole;status:string;created_at:string;expires_at:string}
type TeamData={members:Member[];invitations:Invitation[]}
type Draft={email:string;role:TeamRole;member?:Member}
export default function TeamManagement(){
 const {isAdmin,teamRole,profile}=useAuth();const currentRole=teamRole??(isAdmin?'owner':null);const canManage=currentRole==='owner'||currentRole==='super_admin';const toast=useToast();const formId=useId()
 const [data,setData]=useState<TeamData>({members:[],invitations:[]})
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [draft,setDraft]=useState<Draft|null>(null),[formError,setFormError]=useState('')
 const [remove,setRemove]=useState<Member|null>(null)
 const busyRef=useRef(false)
 const load=useCallback(async()=>{try{const team=await teamRequest<TeamData>({action:'list'});setData(team);setError('')}catch(e){setError(e instanceof Error?e.message:'Team could not be loaded.')}finally{setLoading(false)}},[])
 useEffect(()=>{
  if(!canManage)return
  let active=true
  void teamRequest<TeamData>({action:'list'}).then(team=>{if(active){setData(team);setError('')}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Team could not be loaded.')}).finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[canManage])
 if(!canManage)return null
 const open=(member?:Member)=>{setFormError('');setDraft(member?{email:member.email,role:member.role,member}:{email:'',role:'admin'})}
 async function run(payload:Record<string,unknown>,message:string){
  if(busyRef.current)return false
  busyRef.current=true;setBusy(true);setFormError('')
  try{await teamRequest(payload);toast.success(message);await load();return true}
  catch(e){const message=e instanceof Error?e.message:'Please try again.';setFormError(message);toast.error(message);return false}
  finally{busyRef.current=false;setBusy(false)}
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(!draft)return
  const payload={action:draft.member?'access':'invite',email:draft.email,userId:draft.member?.id,role:draft.role}
  if(await run(payload,draft.member?'Team role updated.':'Invitation email sent.'))setDraft(null)
 }
 return <section id="team-access" className="card pad team-management" aria-labelledby={formId+'-heading'}>
  <div className="team-heading"><div><span className="eyebrow">YOUR STUDIO, TOGETHER</span><h2 className="smalltitle" id={formId+'-heading'}>Team &amp; Roles</h2><p className="sub">Invite people by email and assign an Owner, Super Admin or Admin role.</p></div><button type="button" className="btn" onClick={()=>open()} disabled={busy}><MailPlus size={17} aria-hidden="true"/> Invite member</button></div>
  {error&&<Notice tone="error">{error} <button type="button" className="action" onClick={()=>void load()}>Try again</button></Notice>}
  {loading?<Spinner label="Loading team"/>:<>
   <div className="team-members">{data.members.map(member=><article className="team-member" key={member.id}>
    <span className="avatar" aria-hidden="true">{initials(member.first_name,member.last_name,member.email)}</span>
    <div className="team-member-info"><strong>{`${member.first_name} ${member.last_name}`.trim()||member.email}</strong><span>{member.email}</span><p>{roleLabel(member.role)}</p></div>
    {member.id===profile?.id?<span className="tag green">You</span>:member.role==='owner'||!canAssignRole(currentRole,member.role)?<span className="tag grey">{roleLabel(member.role)}</span>:<button type="button" className="btn soft sm" onClick={()=>open(member)} disabled={busy} aria-label={`Edit role for ${member.email}`}><SlidersHorizontal size={15} aria-hidden="true"/> Role</button>}
   </article>)}</div>
   <div className="team-invitations"><h3>Invitations</h3><p className="tiny">Emails are sent even when the address already has an account. Access starts after the invited email is verified and the invitation is accepted.</p>
    {!data.invitations.length?<div className="team-empty"><UserRound size={22} aria-hidden="true"/><p>No invitations yet. Bring your team into the studio.</p></div>:<div className="tablewrap"><table className="table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.invitations.map(invite=><tr key={invite.id}><td><strong>{invite.email}</strong><span className="tiny team-date">Sent {dateTime(invite.created_at)}</span></td><td>{roleLabel(invite.role)}</td><td><span className={`tag ${invite.status==='accepted'?'green':invite.status==='pending'?'orange':'grey'}`}>{invite.status}</span></td><td><div className="hstack"><button type="button" className="action" disabled={busy||!canAssignRole(currentRole,invite.role)} onClick={()=>void run({action:'invite',email:invite.email,role:invite.role},'Invitation email sent again.')}><Send size={14} aria-hidden="true"/> Resend</button>{canAssignRole(currentRole,invite.role)&&['pending','sending'].includes(invite.status)&&<button type="button" className="action danger" disabled={busy} onClick={()=>void run({action:'revoke',invitation:invite.id},'Invitation revoked.')}><X size={14} aria-hidden="true"/> Revoke</button>}</div></td></tr>)}</tbody></table></div>}
   </div>
  </>}
  {draft&&<Modal title={draft.member?'Edit team role':'Invite to your studio'} width={620} onClose={()=>{if(!busy)setDraft(null)}} footer={<><button type="button" className="btn soft" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button type="submit" form={formId} className="btn" disabled={busy}>{busy?<Spinner label="Sending"/>:draft.member?'Save role':'Send invitation'}</button></>}>
   <form id={formId} onSubmit={e=>void submit(e)}>
    <Field label="Team member email"><input className="input" type="email" autoComplete="email" maxLength={254} required disabled={!!draft.member||busy} value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@example.com"/></Field>
    <Field label="Team role"><select className="input" value={draft.role} disabled={busy} onChange={e=>setDraft({...draft,role:e.target.value as TeamRole})}>{TEAM_ROLES.filter(role=>canAssignRole(currentRole,role.id)).map(role=><option key={role.id} value={role.id}>{role.label}</option>)}</select></Field>
    <div className="team-role-description"><ShieldCheck size={21} aria-hidden="true"/><p>{TEAM_ROLES.find(role=>role.id===draft.role)?.description}</p></div>
    <p className="tiny">Invitations expire after 7 days. Existing accounts receive the email too; they do not need to register again.</p>
    {formError&&<Notice tone="error">{formError}</Notice>}
    {draft.member&&<button type="button" className="action danger team-remove-access" disabled={busy} onClick={()=>{setRemove(draft.member!);setDraft(null)}}>Remove studio access</button>}
   </form>
  </Modal>}
  {remove&&<ConfirmDialog title="Remove studio access?" message={`${remove.email} will keep their customer account but lose access to the studio.`} confirmLabel="Remove access" busy={busy} onClose={()=>setRemove(null)} onConfirm={()=>{void run({action:'access',userId:remove.id,role:'admin'},'Studio access removed.').then(ok=>{if(ok){setRemove(null);setDraft(null)}})}}/>}
 </section>
}
