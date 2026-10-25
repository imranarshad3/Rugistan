import type {IncomingMessage,ServerResponse} from 'node:http'
import {createHmac} from 'node:crypto'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
import {verifyToken} from '@clerk/backend'
import {allowedOrigins,header,object,readBody,RequestError} from './store.js'
import {parseTeamRole,permissionsForRole,canAssignRole,type TeamRole} from '../src/lib/teamAccess.js'
type Env=Record<string,string|undefined>
type Dependencies={env:()=>Env;verify:(token:string,env:Env)=>Promise<string>;database:(env:Env)=>SupabaseClient;clerk:(path:string,method:string,body:unknown,env:Env)=>Promise<Record<string,unknown>>}
const defaults:Dependencies={
 env:()=>process.env,
 verify:async(token,env)=>{const c=await verifyToken(token,{secretKey:env.CLERK_SECRET_KEY!,authorizedParties:allowedOrigins(env)});if(!c.sid||!c.sub.startsWith('user_'))throw Error();return c.sub},
 database:env=>createClient(env.SUPABASE_URL!,env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}}),
 clerk:async(path,method,body,env)=>{
  const r=await fetch('https://api.clerk.com/v1'+path,{method,headers:{Authorization:`Bearer ${env.CLERK_SECRET_KEY}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)})
  if(!r.ok)throw new RequestError(r.status===429?429:502,r.status===429?'Invitation service is busy. Please try again later.':'The invitation email could not be sent. Please retry.')
  return await r.json() as Record<string,unknown>
 },
}
function id(value:unknown){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new RequestError(400,'Choose a valid invitation.');return value}
function selectedRole(body:Record<string,unknown>,allowRemoval=false):TeamRole|null {
 if(allowRemoval&&body.role===null)return null
 try{return parseTeamRole(body.role)}catch{throw new RequestError(400,'Choose Owner, Super Admin or Admin.')}
}
export function createTeamHandler(overrides:Partial<Dependencies>={}){
 const deps={...defaults,...overrides}
 return async(req:IncomingMessage&{body?:unknown},res:ServerResponse)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
  const send=(status:number,body:unknown)=>{res.statusCode=status;res.end(JSON.stringify(body))}
  try{
   const env=deps.env()
   if(req.method!=='POST'){res.setHeader('Allow','POST');throw new RequestError(405,'Method not allowed.')}
   if(!allowedOrigins(env).includes(header(req,'origin'))||header(req,'sec-fetch-site')==='cross-site')throw new RequestError(403,'Origin not allowed.')
   if(!/^application\/json(?:\s*;|$)/i.test(header(req,'content-type')))throw new RequestError(415,'Use application/json.')
   if(!env.CLERK_SECRET_KEY||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.RATE_LIMIT_SECRET)throw new RequestError(503,'Team invitations are not configured.')
   const authorization=header(req,'authorization');if(!/^Bearer [^\s]+$/.test(authorization))throw new RequestError(401,'Please sign in.')
   let userId:string
   try{userId=await deps.verify(authorization.slice(7),env)}catch{throw new RequestError(401,'Please sign in again.')}
   const db=deps.database(env)
   const profile=await db.from('profiles').select('role').eq('id',userId).maybeSingle()
   if(profile.error)throw new RequestError(503,'Could not verify your access.')
   const body=await readBody(req)
   if(!object(body)||typeof body.action!=='string'||!['list','invite','revoke','access','accept'].includes(body.action))throw new RequestError(400,'Choose a valid team action.')
   let actorRole:TeamRole|null=profile.data?.role==='admin'?'owner':null
   if(!actorRole&&body.action!=='accept'){
    const assigned=await db.from('team_access').select('role').eq('user_id',userId).maybeSingle()
    if(assigned.error)throw new RequestError(503,'Could not verify your role.')
    if(assigned.data)actorRole=parseTeamRole(assigned.data.role)
   }
   if(body.action!=='accept'&&!['owner','super_admin'].includes(actorRole??''))throw new RequestError(403,'Only an Owner or Super Admin can manage the team.')
   const quota=await db.rpc('consume_store_quota',{p_action:body.action==='invite'?'contact':'view',p_key:createHmac('sha256',env.RATE_LIMIT_SECRET!).update(`team:${userId}:${body.action}`).digest('hex')})
   if(quota.error||!quota.data||typeof quota.data.allowed!=='boolean')throw new RequestError(503,'Could not check the request limit.')
   if(!quota.data.allowed){res.setHeader('Retry-After',String(quota.data.retry_after||3600));throw new RequestError(429,'Too many team requests. Please try again later.')}
   if(body.action==='list'){
    const [admins,assigned,invitations]=await Promise.all([
     db.from('profiles').select('id,email,first_name,last_name').eq('role','admin'),
     db.from('team_access').select('user_id,role,permissions,profile:profiles!team_access_user_id_fkey(id,email,first_name,last_name)'),
     db.from('team_invitations').select('id,email,role,permissions,is_admin,status,created_at,expires_at').order('created_at',{ascending:false}).limit(100),
    ])
    if(admins.error||assigned.error||invitations.error)throw new RequestError(503,'Team access could not be loaded.')
    const members=(admins.data??[]).map(p=>({...p,isAdmin:true,role:'owner',permissions:[]}))
    for(const row of assigned.data??[]){const p=Array.isArray(row.profile)?row.profile[0]:row.profile;if(p&&!members.some(m=>m.id===row.user_id))members.push({...p,isAdmin:false,role:row.role,permissions:row.permissions} as typeof members[number])}
    send(200,{data:{members,invitations:invitations.data}});return
   }
   if(body.action==='invite'){
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():''
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new RequestError(400,'Enter a valid email address.')
    const role=selectedRole(body)!
    if(!canAssignRole(actorRole,role))throw new RequestError(403,'You cannot assign this role.')
    const selected={isAdmin:role==='owner',permissions:role==='owner'?[]:permissionsForRole(role)}
    const prepared=await db.rpc('team_prepare_invitation',{p_actor:userId,p_email:email,p_permissions:selected.permissions,p_is_admin:selected.isAdmin,p_role:role})
    if(prepared.error||!prepared.data?.id)throw new RequestError(503,'Could not prepare this invitation.')
    const invitationId=id(prepared.data.id)
    try{
     // Existing users and previously invited addresses must still receive an email.
     const invitation=await deps.clerk('/invitations','POST',{email_address:email,ignore_existing:true,notify:true,expires_in_days:7,redirect_url:new URL(`/team/accept?invitation=${invitationId}`,header(req,'origin')).href,public_metadata:{rugistan_invitation:invitationId}},env)
     if(typeof invitation.id!=='string')throw new Error('Invalid invitation response')
     const saved=await db.from('team_invitations').update({clerk_invitation_id:invitation.id,status:'pending'}).eq('id',invitationId).eq('status','sending').select('id')
     if(saved.error||!saved.data?.length)throw new RequestError(503,'The email was sent, but the invitation is no longer active. Please resend.')
     send(200,{data:{sent:true,id:invitationId}})
    }catch(error){await db.from('team_invitations').update({status:'failed'}).eq('id',invitationId).eq('status','sending');throw error}
    return
   }
   if(body.action==='accept'){
    const invitationId=id(body.invitation)
    const pending=await db.from('team_invitations').select('email,status,expires_at,accepted_by').eq('id',invitationId).maybeSingle()
    if(pending.error)throw new RequestError(503,'This invitation could not be checked.')
    if(pending.data?.status==='accepted'&&pending.data.accepted_by===userId){send(200,{data:{accepted:true}});return}
    if(!pending.data||pending.data.status!=='pending'||Date.parse(pending.data.expires_at)<=Date.now())throw new RequestError(403,'This invitation is no longer active.')
    const invitedEmail=pending.data.email
    const clerkUser=await deps.clerk('/users/'+encodeURIComponent(userId),'GET',undefined,env)
    const emails=Array.isArray(clerkUser.email_addresses)?clerkUser.email_addresses:[]
    const primary=emails.find((e:unknown)=>object(e)&&typeof e.email_address==='string'&&e.email_address.toLowerCase()===invitedEmail&&object(e.verification)&&e.verification.status==='verified')
    if(!object(primary)||typeof primary.email_address!=='string'||!object(primary.verification)||primary.verification.status!=='verified')throw new RequestError(403,'Verify your invited email address before accepting.')
    const accepted=await db.rpc('team_accept_invitation',{p_invitation:invitationId,p_user:userId,p_verified_email:primary.email_address})
    if(accepted.error)throw new RequestError(403,'This invitation is inactive, expired, or belongs to a different email address.')
    send(200,{data:{accepted:true}});return
   }
   if(body.action==='revoke'){
    const target=await db.from('team_invitations').select('role').eq('id',id(body.invitation)).maybeSingle()
    if(target.error||!target.data||!canAssignRole(actorRole,target.data.role as TeamRole))throw new RequestError(403,'You cannot manage this invitation.')
    const revoked=await db.from('team_invitations').update({status:'revoked'}).eq('id',id(body.invitation)).in('status',['sending','pending']).select('clerk_invitation_id')
    if(revoked.error)throw new RequestError(503,'Could not revoke the invitation.')
    // Database revocation takes effect even if the external email link cannot be revoked.
    for(const row of revoked.data??[])if(row.clerk_invitation_id){try{await deps.clerk('/invitations/'+encodeURIComponent(row.clerk_invitation_id)+'/revoke','POST',{},env)}catch{ /* The access grant remains revoked. */ }}
    send(200,{data:{revoked:true}});return
   }
   const role=selectedRole(body,true)
   if(role&&!canAssignRole(actorRole,role))throw new RequestError(403,'You cannot assign this role.')
   const selected={isAdmin:role==='owner',permissions:role==='owner'?[]:permissionsForRole(role)}
   if(typeof body.userId!=='string'||!/^user_[a-zA-Z0-9]+$/.test(body.userId))throw new RequestError(400,'Choose a valid team member.')
   const updated=await db.rpc('team_set_access',{p_actor:userId,p_user:body.userId,p_permissions:selected.permissions,p_is_admin:selected.isAdmin,p_role:role})
   if(updated.error)throw new RequestError(400,'Access could not be changed. You cannot change your own role, change an Owner, or manage a higher role.')
   send(200,{data:{updated:true}})
  }catch(error){if(error instanceof RequestError)send(error.status,{error:error.message});else{console.error('team_request_failed');send(503,{error:'The team request could not be completed. Please try again.'})}}
 }
}
export default createTeamHandler()
