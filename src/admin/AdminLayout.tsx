import { useCurrency } from '../lib/currency'
import { ArrowUpRight, ChevronDown, ChevronRight, CalendarDays, ExternalLink, Menu } from 'lucide-react'
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
  { to: '/admin/pages', icon: 'pages', label: 'Website Content' },
  { to: '/admin/reviews', icon: 'reviews', label: 'Reviews' },
  { to: '/admin/analytics', icon: 'analytics', label: 'Analytics' },
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
  const { profile, signOut } = useAuth()
  const { store } = useStore()
  const displayCurrency = useCurrency()
  const { pathname } = useLocation()
  const [sideOpen, setSideOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
    setSideOpen(false)
    setMenuOpen(false)
  }, [pathname])

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
      <div className="app">
        {sideOpen && <div className="sidescrim" onClick={() => setSideOpen(false)} role="presentation" />}
        <aside className={`side ${sideOpen ? 'open' : ''}`.trim()}>
          <Link to="/admin" className="logo">
            {store.name}
            <small>{store.tagline}</small>
          </Link>
          <div className="side-lbl">STORE MANAGEMENT</div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive || (item.to === '/admin/pages' && pathname.startsWith('/admin/banners')) ? 'active' : ''}`.trim()}
            >
              <span className="navicon" aria-hidden="true">
                <AdminIcon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
          <div className="side-foot">
            <Link to="/" target="_blank" rel="noreferrer">
              <ArrowUpRight size={16} aria-hidden="true" /> View Storefront
            </Link>
            <span>© {store.name} Studio</span>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="topbar-left">
              <button type="button" className="sidetoggle" onClick={() => setSideOpen(true)} aria-label="Open menu">
                <Menu size={22} aria-hidden="true" />
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
                  <span className="user-identity"><strong>{profile?.first_name || 'Admin'}</strong><small>Store administrator</small></span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 400 }} aria-hidden="true">
                    <ChevronDown size={16} aria-hidden="true" />
                  </span>
                </button>
                {menuOpen && (
                  <div className="menupop" role="menu">
                    <Link to="/admin/profile" role="menuitem">
                      Admin Profile
                    </Link>
                    <Link to="/admin/settings" role="menuitem">
                      Store Settings
                    </Link>
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
          </div>

          <main ref={contentRef} className="content" data-page={pathname.replace(/^\/admin\/?/, "") || "dashboard"}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
