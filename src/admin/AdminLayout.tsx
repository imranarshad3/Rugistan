import {permissionForAdminPath} from '../lib/teamAccess'
import { useCurrency } from '../lib/currency'
import { ArrowUpRight, ChevronDown, ChevronRight, CalendarDays, ExternalLink, Menu, PanelLeftClose, PanelLeftOpen, FolderCog, X } from 'lucide-react'
import AdminIcon from './components/AdminIcon'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { initials, longDate, titleCase } from '../lib/format'

const NAV = [
  { to: '/admin', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/admin/products', icon: 'products', label: 'Products' },
  { to: '/admin/categories', icon: 'categories', label: 'Categories' },
  { to: '/admin/orders', icon: 'orders', label: 'Orders' },
  { to: '/admin/customers', icon: 'customers', label: 'Customers' },
  { to: '/admin/reviews', icon: 'reviews', label: 'Reviews' },
  { to: '/admin/analytics', icon: 'analytics', label: 'Analytics' },
  { to: '/admin/pages', icon: 'pages', label: 'Website Content' },
  { to: '/admin/settings', icon: 'settings', label: 'Settings' },
]

function crumbFor(pathname: string) {
  const parts = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  if (!parts.length) return 'Dashboard'
  if (parts[0] === 'products' && parts[1]) return parts[1] === 'new' ? 'Add Product' : 'Edit Product'
  if (parts[0] === 'pages' && parts[1]) return parts[1] === 'new' ? 'New Page' : 'Edit Page'
  if (parts[0] === 'orders' && parts[1]) return 'Order Details'
  return parts.map((p) => (/^[0-9a-f-]{20,}$/i.test(p) ? 'Detail' : titleCase(p))).join(' / ')
}

export default function AdminLayout() {
  const { profile, signOut, isAdmin, teamRole, permissions } = useAuth()
  const availableNav=NAV.filter(item=>isAdmin||permissions?.includes(permissionForAdminPath(item.to) as typeof permissions[number]))
  const { store } = useStore()
  const displayCurrency = useCurrency()
  const { pathname, hash } = useLocation()
  const managementActive = /^\/admin\/(pages|banners|settings)(\/|$)/.test(pathname)
  const [management, setManagement] = useState({path: pathname, open: managementActive})
  const managementOpen = management.path === pathname ? management.open : managementActive
  const [menuOpen, setMenuOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:900px)').matches)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sidebarVisible = mobile ? sideOpen : !sideCollapsed
  useEffect(() => {
    const query = window.matchMedia('(max-width:900px)')
    const update = () => { setMobile(query.matches); setSideOpen(false) }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        if (sideOpen) { setSideOpen(false); toggleRef.current?.focus() }
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [sideOpen])
  const menuRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
    setSideOpen(false)
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if(hash!=='#team-access')return
    const frame=requestAnimationFrame(()=>document.getElementById('team-access')?.scrollIntoView({block:'start',behavior:'instant'}))
    return ()=>cancelAnimationFrame(frame)
  },[pathname,hash])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <div className="rg-admin">
      <div className={`app ${sideCollapsed ? 'sidebar-collapsed' : ''}`}>
        {mobile && sideOpen && <div className="sidescrim" onClick={() => setSideOpen(false)} role="presentation" />}
        <aside id="admin-sidebar" aria-label="Studio navigation" inert={!sidebarVisible} className={`side ${sideOpen ? 'open' : ''}`.trim()}>
          <button type="button" className="sidebar-close" aria-label="Close sidebar" onClick={() => {setSideOpen(false); toggleRef.current?.focus()}}><X size={20} aria-hidden="true" /></button>
          <Link to="/admin" className="logo">
            {store.name}
            <small>{store.tagline}</small>
          </Link>
          <div className="side-lbl">STORE MANAGEMENT</div>
          {availableNav.filter(item => !['/admin/pages','/admin/settings'].includes(item.to)).map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({isActive})=>`nav-link ${isActive?'active':''}`}>
              <span className="navicon" aria-hidden="true"><AdminIcon name={item.icon} /></span>{item.label}
            </NavLink>
          ))}
          {availableNav.some(item=>['/admin/pages','/admin/settings'].includes(item.to))&&<div className="management-folder">
            <button type="button" className={`management-toggle ${managementActive ? 'active' : ''}`} aria-expanded={managementOpen} aria-controls="management-links" onClick={()=>setManagement({path:pathname,open:!managementOpen})}>
              <FolderCog size={19} aria-hidden="true" /><span>Management</span><ChevronDown className={managementOpen?'expanded':''} size={16} aria-hidden="true" />
            </button>
            <div id="management-links" className="management-links" hidden={!managementOpen}>
              {availableNav.filter(item=>['/admin/pages','/admin/settings'].includes(item.to)).map(item=>(
                <NavLink key={item.to} to={item.to} className={({isActive})=>`nav-link ${isActive||(item.to==='/admin/pages'&&pathname.startsWith('/admin/banners'))?'active':''}`}>
                  <span className="navicon" aria-hidden="true"><AdminIcon name={item.icon} /></span>{item.label}
                </NavLink>
              ))}
            </div>
          </div>}
          <div className="side-foot">
            <Link to="/" target="_blank" rel="noreferrer">
              <ArrowUpRight size={16} aria-hidden="true" /> View Storefront
            </Link>
            <span>© {store.name} Studio</span>
          </div>
        </aside>

        <div className="main">
          <header className="topbar" aria-label="Studio toolbar">
            <div className="topbar-left">
              <button type="button" ref={toggleRef} className="sidetoggle" onClick={() => mobile ? setSideOpen(v => !v) : setSideCollapsed(v => !v)} aria-label={sidebarVisible ? 'Close sidebar' : 'Open sidebar'} aria-expanded={sidebarVisible} aria-controls="admin-sidebar">
                {mobile ? <Menu size={20} aria-hidden="true" /> : sidebarVisible ? <PanelLeftClose size={20} aria-hidden="true" /> : <PanelLeftOpen size={20} aria-hidden="true" />}
              </button>
              <nav className="bread" aria-label="Breadcrumb"><Link to="/admin">Studio</Link><ChevronRight className="breadcrumb-chevron" aria-hidden="true"/><strong>{crumbFor(pathname)}</strong></nav>
            </div>
            <div className="user">
              <Link className="visit-store" to="/" target="_blank" rel="noreferrer" aria-label="Visit store (opens in a new tab)"><span>Visit Store</span><ExternalLink aria-hidden="true"/></Link>
              <span className="admin-currency-note" title={displayCurrency.error || `Display conversion only. Store base and billing currency: ${store.currency}.`}>{displayCurrency.loading || displayCurrency.error ? store.currency : displayCurrency.code}<small> display</small></span>
              <span className="topbar-date"><CalendarDays aria-hidden="true"/>{longDate(new Date().toISOString())}</span>
              <div className="usermenu" ref={menuRef}>
                <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-haspopup="menu">
                  <span className="avatar">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(profile?.first_name, profile?.last_name, profile?.email)}
                  </span>
                  <span className="user-identity"><strong>{profile?.first_name || 'Admin'}</strong><small>{isAdmin?'Owner':teamRole==='super_admin'?'Super Admin':'Admin'}</small></span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 400 }} aria-hidden="true">
                    <ChevronDown size={16} aria-hidden="true" />
                  </span>
                </button>
                {menuOpen && (
                  <div className="menupop" role="menu">
                    <Link to="/admin/profile" role="menuitem">
                      Admin Profile
                    </Link>
                    {(isAdmin||teamRole==='super_admin')&&<Link to="/admin/profile#team-access" role="menuitem">Team &amp; Roles</Link>}
                    {(isAdmin||permissions.includes('settings'))&&<Link to="/admin/settings" role="menuitem">
                      Store Settings
                    </Link>}
                    <Link to="/" target="_blank" rel="noreferrer" role="menuitem">
                      View Storefront
                    </Link>
                    <button type="button" role="menuitem" onClick={() => void signOut()}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main ref={contentRef} className="content" data-page={pathname.replace(/^\/admin\/?/, "") || "dashboard"}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
