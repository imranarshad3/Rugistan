import {firstTeamRoute} from '../../lib/teamAccess'
import { SignIn } from '@clerk/react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'

export default function AdminLogin() {
  const { signOut, user, isAdmin, isStaff, permissions, loading, error, refreshProfile } = useAuth()
  const { store } = useStore()
  if (!loading && user && isStaff) return <Navigate to={isAdmin?'/admin':firstTeamRoute(permissions)} replace />
  return <div className="rg-admin login-shell"><div className="login-screen">
    <div className="login-photo"><img src="/assets/rug-living-hero.webp" alt="" aria-hidden="true" /><div><p>{store.name.toUpperCase()} · {store.tagline}</p><h1>Crafting timeless beauty.<br/>Managing every detail.</h1></div></div>
    <div className="login-body"><div className="login-card"><Link className="login-logo" to="/" aria-label="Rugistan home"><img src={store.logo_url || "/assets/rugistan-wordmark.webp"} alt={store.name} /></Link><div className="eyebrow">ADMINISTRATOR ACCESS</div>
      {loading ? <p className="sub">Checking your session…</p> : user ? <><h1>Administrator access required</h1><p className="sub">{error || 'Your account is signed in, but it has not been granted a store administrator role.'}</p><div className="login-actions"><button type="button" className="btn" onClick={() => void refreshProfile()}>Check access again</button><button type="button" className="btn soft" onClick={() => void signOut()}>Sign out</button></div><Link className="login-return" to="/">← Return to store</Link></> : <><h1>Welcome Back</h1><p className="sub">Sign in with your administrator account.</p><SignIn routing="path" path="/admin/login" forceRedirectUrl="/admin" signUpUrl="/register" appearance={{elements:{cardBox:{boxShadow:'none',width:'100%'},card:{boxShadow:'none',background:'transparent',padding:'0'},header:{display:'none'},footer:{display:'none'},formButtonPrimary:{background:'#4b2812',color:'#fffaf2',minHeight:'3rem'}}}} /></>}
    </div></div>
  </div></div>
}
