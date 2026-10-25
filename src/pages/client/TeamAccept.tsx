import {useEffect,useRef,useState} from 'react'
import {Link,Navigate,useNavigate,useSearchParams} from 'react-router-dom'
import {useAuth} from '../../context/AuthContext'
import {teamRequest} from '../../lib/teamApi'
import {Logo,Spinner} from '../../components/client/Primitives'
export default function TeamAccept(){
 const {user,profile,loading,error:authError,refreshProfile}=useAuth()
 const [params]=useSearchParams(),navigate=useNavigate()
 const invitation=params.get('invitation')??''
 const [error,setError]=useState(''),[accepting,setAccepting]=useState(false)
 const inFlight=useRef(false)
 const next='/team/accept?invitation='+encodeURIComponent(invitation)
 useEffect(()=>{document.title='Team Invitation · Rugistan'},[])
 async function accept(){
  if(inFlight.current)return
  inFlight.current=true;setAccepting(true);setError('')
  try{await teamRequest({action:'accept',invitation});await refreshProfile();navigate('/admin',{replace:true})}
  catch(e){setError(e instanceof Error?e.message:'This invitation could not be accepted.')}
  finally{inFlight.current=false;setAccepting(false)}
 }
 if(!/^[0-9a-f-]{36}$/i.test(invitation))return <section className="section wrap"><h1>Invitation unavailable</h1><p>Ask an administrator to send a new invitation.</p><Link to="/">Return to store</Link></section>
 if(!loading&&!user)return <Navigate to={'/login?next='+encodeURIComponent(next)} replace />
 return <section className="team-accept section wrap"><Logo/><div className="eyebrow">YOUR PLACE IN THE STUDIO</div><h1>Join the Rugistan team.</h1><p>Accept your invitation to access the areas assigned by your administrator.</p>{loading?<Spinner label="Checking your account"/>:<><p className="tiny">Signed in as {profile?.email||user?.email}. Use the email address that received the invitation.</p>{(error||authError)&&<div className="notice error" role="alert">{error||authError}</div>}<button type="button" className="btn" disabled={accepting||!profile} onClick={()=>void accept()}>{accepting?<Spinner label="Accepting"/>:'Accept invitation'}</button><Link className="inline-link" to="/account">Return to my account</Link></>}</section>
}
