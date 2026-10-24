import { SignIn, SignUp } from '@clerk/react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/client/Primitives'

function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <div className="auth-screen">
    <div className="auth-photo"><img src="/assets/rug-living-hero.webp" alt="" aria-hidden="true" /><div><div className="eyebrow">RUGISTAN · HANDMADE RUGS</div><h2>Tradition woven into every thread.</h2><p className="auth-caption">Natural materials. Thoughtful design. A home that feels like you.</p></div></div>
    <div className="auth-body"><div className="auth-card"><Logo /><div className="eyebrow">YOUR RUGISTAN ACCOUNT</div><h1>{title}</h1><p className="subtitle" style={{ marginBottom: 26 }}>{intro}</p><div className="clerk-auth-panel">{children}</div></div></div>
  </div>
}
const appearance = {
  elements: {
    rootBox: { width: '100%' }, cardBox: { width: '100%', boxShadow: 'none' },
    card: { boxShadow: 'none', border: 'none', background: 'transparent', padding: '0' },
    footer: { display: 'none' },
    headerTitle: { fontFamily: 'DM Serif Display, Georgia, serif' },
    formButtonPrimary: { background: '#4b2812', color: '#fffaf2', boxShadow: 'none', minHeight: '3.25rem', fontSize: '.875rem' },
    formFieldInput: { background: '#fffdf8', border: '1px solid #dfcfb9', borderRadius: '3px', minHeight: '3.25rem', boxShadow: 'none', fontSize: '1rem' },
    formFieldLabel: { color: '#351b10', fontSize: '.875rem', marginBottom: '.5rem' },
    socialButtonsBlockButton: { background: '#fffdf8', border: '1px solid #dfcfb9', minHeight: '3.25rem', boxShadow: 'none' },
  },
}
function safeNext(value: string | null) { return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/account' }
export function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={next} replace />
  return <AuthShell title="Welcome Back" intro="Sign in to track orders, save rugs and check out faster."><SignIn routing="path" path="/login" signUpUrl={`/register?next=${encodeURIComponent(next)}`} forceRedirectUrl={next} appearance={appearance} /><p className="auth-switch">New to Rugistan? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p></AuthShell>
}
export function Register() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={next} replace />
  return <AuthShell title="Join Rugistan" intro="Save your favourite rugs, track orders and check out in moments."><SignUp routing="path" path="/register" signInUrl={`/login?next=${encodeURIComponent(next)}`} forceRedirectUrl={next} appearance={appearance} /><p className="auth-switch">Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p></AuthShell>
}
export function ForgotPassword() {
  return <AuthShell title="Account Recovery" intro="Use the Forgot password option below to securely recover your account."><SignIn routing="hash" signUpUrl="/register" forceRedirectUrl="/account" appearance={appearance} /><p className="auth-switch"><Link to="/login">Back to sign in</Link></p></AuthShell>
}
export function ResetPassword() { return <ForgotPassword /> }
