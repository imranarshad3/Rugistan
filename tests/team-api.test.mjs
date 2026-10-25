import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {createServer as httpServer} from 'node:http'
import {createServer as viteServer} from 'vite'
const vite=await viteServer({configFile:false,cacheDir:'/tmp/rugistan-team-unit-vite',server:{middlewareMode:true},appType:'custom'})
const {createTeamHandler}=await vite.ssrLoadModule('/server/team.ts')
after(()=>vite.close())
const origin='https://rugistan.vercel.app'
const invitation='73000000-0000-4000-8000-000000000001'
const env={VERCEL:'1',CLERK_SECRET_KEY:'test-secret',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service',RATE_LIMIT_SECRET:'a'.repeat(64)}
async function fixture(run,options={}){
 const calls=[]
 const db={from(table){let op='select',patch;const query={select(){return query},eq(){return query},in(){return query},order(){return query},limit(){return query},update(value){op='update';patch=value;calls.push({table,patch});return query},async maybeSingle(){if(table==='profiles')return {data:{role:options.role??'admin'},error:null};if(table==='team_access')return {data:options.teamRole?{role:options.teamRole}:null,error:null};return {data:options.pending===null?null:{email:'existing@example.test',status:options.status??'pending',expires_at:options.expires??'2099-01-01',...options.pending},error:null}},then(resolve,reject){const result={data:op==='update'?[{id:invitation}]:[],error:null};return Promise.resolve(result).then(resolve,reject)}};return query},async rpc(name,args){calls.push({rpc:name,args});if(name==='consume_store_quota')return options.quota??{data:{allowed:true},error:null};if(name==='team_prepare_invitation')return {data:{id:invitation},error:null};return {data:{accepted:true},error:null}}}
 const handler=createTeamHandler({env:()=>env,database:()=>db,verify:async token=>{if(token!=='valid')throw Error('private verification detail');return options.userId??'user_Admin'},clerk:async(path,method,body)=>{calls.push({clerk:path,method,body});if(options.providerError)throw Error('secret provider diagnostic');if(path.startsWith('/users/'))return {primary_email_address_id:'primary',email_addresses:options.emails??[{id:'primary',email_address:'existing@example.test',verification:{status:'verified'}}]};return {id:'inv_test'}}})
 const server=httpServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`
 const send=(payload,headers={})=>fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer valid',...headers},body:JSON.stringify(payload)})
 try{await run(send,calls)}finally{await new Promise(r=>server.close(r))}
}
const invite={action:'invite',email:'EXISTING@example.test',role:'admin'}
test('existing and previously invited accounts receive a new invitation email',()=>fixture(async(send,calls)=>{
 assert.equal((await send(invite)).status,200);assert.equal((await send(invite)).status,200)
 const emails=calls.filter(c=>c.clerk==='/invitations');assert.equal(emails.length,2)
 for(const email of emails){assert.equal(email.body.email_address,'existing@example.test');assert.equal(email.body.ignore_existing,true);assert.equal(email.body.notify,true);assert.match(email.body.redirect_url,/^https:\/\/rugistan\.vercel\.app\/team\/accept\?invitation=/)}
 assert.equal(calls.filter(c=>c.rpc==='team_accept_invitation').length,0)
}))
test('customers and restricted staff cannot invite or edit team access',()=>fixture(async(send,calls)=>{
 assert.equal((await send(invite)).status,403);assert.equal((await send({action:'access',userId:'user_Target',isAdmin:true,permissions:[]})).status,403);assert.equal(calls.length,0)
},{role:'customer'}))
test('invalid emails, unknown permissions and truthy admin strings are rejected',()=>fixture(async(send,calls)=>{
 for(const payload of [{...invite,email:'not-an-email'},{...invite,role:'all'},{...invite,role:true},{...invite,role:null}])assert.equal((await send(payload)).status,400)
 assert.equal(calls.filter(c=>c.clerk).length,0)
}))
test('cross-origin and forged sessions never reach email delivery',()=>fixture(async(send,calls)=>{
 assert.equal((await send(invite,{Origin:'https://attacker.example'})).status,403)
 assert.equal((await send(invite,{Authorization:'Bearer forged'})).status,401)
 assert.equal(calls.length,0)
}))
test('invitation quota fails closed before email or access changes',()=>fixture(async(send,calls)=>{
 assert.equal((await send(invite)).status,503);assert.equal(calls.filter(c=>c.clerk||c.rpc==='team_prepare_invitation').length,0)
},{quota:{data:null,error:{message:'offline'}}}))
test('provider failure marks invitation failed and does not grant access',()=>fixture(async(send,calls)=>{
 const r=await send(invite);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret provider diagnostic/)
 assert.ok(calls.some(c=>c.patch?.status==='failed'));assert.ok(!calls.some(c=>c.rpc==='team_accept_invitation'))
},{providerError:true}))
test('acceptance uses the verified invited email and session user, ignoring forged identities',()=>fixture(async(send,calls)=>{
 const r=await send({action:'accept',invitation,userId:'user_Attacker',email:'attacker@example.test',isAdmin:true});assert.equal(r.status,200)
 const accepted=calls.find(c=>c.rpc==='team_accept_invitation');assert.equal(accepted.args.p_user,'user_Member');assert.equal(accepted.args.p_verified_email,'existing@example.test')
},{role:'customer',userId:'user_Member',emails:[{id:'primary',email_address:'another@example.test',verification:{status:'verified'}},{id:'secondary',email_address:'existing@example.test',verification:{status:'verified'}}]}))
test('unverified email cannot accept a team invitation',()=>fixture(async(send,calls)=>{
 assert.equal((await send({action:'accept',invitation})).status,403);assert.ok(!calls.some(c=>c.rpc==='team_accept_invitation'))
},{role:'customer',emails:[{id:'primary',email_address:'existing@example.test',verification:{status:'unverified'}}]}))
test('expired or revoked invitations do not call Clerk or grant privileges',async()=>{
 for(const options of [{expires:'2000-01-01'},{status:'revoked'},{pending:null}])await fixture(async(send,calls)=>{assert.equal((await send({action:'accept',invitation})).status,403);assert.ok(!calls.some(c=>c.clerk||c.rpc==='team_accept_invitation'))},{role:'customer',...options})
})
test('access editing forwards only validated areas with the trusted administrator identity',()=>fixture(async(send,calls)=>{
 assert.equal((await send({action:'access',userId:'user_Target',actor:'user_Forged',role:'super_admin'})).status,200)
 assert.deepEqual(calls.find(c=>c.rpc==='team_set_access').args,{p_actor:'user_Admin',p_user:'user_Target',p_is_admin:false,p_role:'super_admin',p_permissions:['products','categories','orders','customers','content','reviews','analytics','settings']})
}))

test('Super Admin can invite Admin but cannot promote peers or Owners',()=>fixture(async(send,calls)=>{
 assert.equal((await send(invite)).status,200)
 for(const role of ['super_admin','owner'])assert.equal((await send({...invite,role})).status,403)
 assert.equal(calls.filter(c=>c.clerk==='/invitations').length,1)
},{role:'customer',teamRole:'super_admin'}))
