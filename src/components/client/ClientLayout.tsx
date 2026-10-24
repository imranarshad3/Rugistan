import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { useStore } from '../../context/StoreContext'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useWishlist } from '../../context/WishlistContext'
import { useToast } from '../../context/ToastContext'
import { Logo, Spinner } from './Primitives'
import Icon from './Icon'
import CurrencySelector from './CurrencySelector'
import { useCurrency } from '../../lib/currency'

const PRIMARY = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/collections', label: 'Collections' },
  { to: '/our-story', label: 'About' },
]
const SECONDARY = [
  { to: '/rug-care', label: 'Rug Care' },
  { to: '/contact', label: 'Contact' },
]

function Announcement() {
  const { store } = useStore()
  return (
    <div className="announcement reference-announcement">
      <span className="announcement-shipping"><Icon name="truck" />{store.announcement?.[0] || 'Free Shipping on All Rugs'}</span>
      <span>Handmade by Artisans</span>
      <span>A More Beautiful Home</span>
      <CurrencySelector />
    </div>
  )
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        role="search"
        style={{ background: '#fffaf4', padding: '34px 5%', animation: 'rgFade .25s' }}
      >
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            const q = term.trim()
            onClose()
            navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop')
          }}
          style={{ maxWidth: 740, margin: '0 auto', display: 'flex', gap: 12 }}
        >
          <label className="sr-only" htmlFor="site-search">
            Search rugs
          </label>
          <input
            id="site-search"
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search rugs by name, colour or material…"
            style={{ flex: 1, padding: 16, border: '1px solid #e0d3c8', background: '#fffefa' }}
          />
          <button className="btn" type="submit">
            Search
          </button>
          <button className="btn outline" type="button" onClick={onClose}>
            Close
          </button>
        </form>
      </div>
    </div>
  )
}

function MobileDrawer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} role="presentation" />
      <nav className="drawer" aria-label="Mobile">
        <button type="button" className="closebtn" onClick={onClose} aria-label="Close menu">
          ✕
        </button>
        {[...PRIMARY, ...SECONDARY].map((l) => (
          <Link key={l.to} to={l.to} onClick={onClose}>
            {l.label}
          </Link>
        ))}
        <Link to={user ? '/account' : '/login'} onClick={onClose}>
          {user ? 'My Account' : 'Sign In'}
        </Link>
        <Link to="/account/wishlist" onClick={onClose}>
          Wishlist
        </Link>
        <Link to="/track-order" onClick={onClose}>
          Track Order
        </Link>
      </nav>
    </>
  )
}


function Nav() {
  const { user } = useAuth()
  const cart = useCart()
  const wishlist = useWishlist()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <nav className={`nav ${stuck ? 'stuck' : ''}`} aria-label="Primary">
        <button type="button" className="burger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
        <div className="navlinks">
          {[...PRIMARY, ...SECONDARY].map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <Logo />
        <div className="navright">
          <button type="button" className="header-action header-search" onClick={() => setSearchOpen(true)} aria-label="Search rugs">
            <span>Search</span><Icon name="search" />
          </button>
          <Link to={user ? '/account' : '/login'} className="header-action header-account" aria-label={user ? 'My account' : 'Sign in'}>
            <span>Account</span><Icon name="user" />
          </Link>
          <Link to="/account/wishlist" className="header-action header-wishlist" aria-label={`Wishlist, ${wishlist.count} saved`}>
            <Icon name="heart" /><span className="header-wishlist-count">{wishlist.count}</span>
          </Link>
          <Link to="/cart" className="header-action header-cart" aria-label={`Cart, ${cart.count} items`}>
            <Icon name="cart" /><span className="header-cart-count">{cart.count}</span>
          </Link>
        </div>
      </nav>
      {menuOpen && <MobileDrawer onClose={() => setMenuOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  )
}

function Newsletter() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function subscribe(e: FormEvent) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: value })
    setBusy(false)
    if (error && !/duplicate|already exists/i.test(error.message)) {
      toast.error(readableError(error))
      return
    }
    setEmail('')
    toast.success('Thank you — you are on the list.')
  }

  return (
    <div className="newsletter">
      <div>
        <h3>Join Our Newsletter</h3>
        <p>New collections, handmade stories and exclusive updates.</p>
      </div>
      <form className="subscribe" onSubmit={subscribe}>
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          required
        />
        <button type="submit" disabled={busy}>
          {busy ? <Spinner /> : 'Subscribe'}
        </button>
      </form>
    </div>
  )
}

function Footer() {
  const { store } = useStore()
  const currency = useCurrency()
  const social = Object.entries(store.social ?? {}).filter(([, url]) => url)

  return (
    <>
      <footer className="footer">
        <div>
          <Logo />
          <p style={{ marginTop: 20, maxWidth: 210 }}>
            Artisan-crafted rugs, timeless beauty and meaningful living spaces.
          </p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li>
              <Link to="/shop">All Rugs</Link>
            </li>
            <li>
              <Link to="/shop?sort=newest">New Arrivals</Link>
            </li>
            <li>
              <Link to="/shop?featured=1">Best Sellers</Link>
            </li>
            <li>
              <Link to="/collections">Collections</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>About</h4>
          <ul>
            <li>
              <Link to="/our-story">Our Story</Link>
            </li>
            <li>
              <Link to="/our-story#process">Craftsmanship</Link>
            </li>
            <li>
              <Link to="/page/size-guide">Size Guide</Link>
            </li>
            <li>
              <Link to="/page/faqs">FAQs</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Customer Care</h4>
          <ul>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
            <li>
              <Link to="/page/shipping-and-returns">Delivery &amp; Returns</Link>
            </li>
            <li>
              <Link to="/rug-care">Rug Care</Link>
            </li>
            <li>
              <Link to="/track-order">Track Order</Link>
            </li>
          </ul>
        </div>
        <Newsletter />
        <div className="footer-social">
          <h4>Stay Connected</h4>
          {social.length ? (
            <p>
              {social.map(([name, url], i) => (
                <span key={name}>
                  {i > 0 && '  '}
                  <a href={url} target="_blank" rel="noreferrer noopener">
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </a>
                </span>
              ))}
            </p>
          ) : (
            <>
            <p>A little inspiration for a thoughtfully layered home.</p>
            <Link className="footer-contact" to="/contact">Let’s talk rugs <span aria-hidden="true">↗</span></Link>
            </>
          )}
          {store.email && (
            <p>
              <a href={`mailto:${store.email}`}>{store.email}</a>
            </p>
          )}
          {store.phone && (
            <p>
              <a href={`tel:${store.phone.replace(/\s/g, '')}`}>{store.phone}</a>
            </p>
          )}
        </div>
      </footer>
      {currency.code !== store.currency && !currency.error && <div className="currency-disclosure">Prices in {currency.code} are estimates. Orders are charged in {store.currency}. <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a></div>}
      {currency.error && <div className="currency-disclosure">{currency.error}</div>}
      <div className="legal">
        <span>
          © {new Date().getFullYear()} {store.name}. All rights reserved.
        </span>
        <span>
          <Link to="/page/privacy-policy">Privacy Policy</Link>
          {'  |  '}
          <Link to="/page/shipping-and-returns">Terms of Service</Link>
        </span>
      </div>
    </>
  )
}

export default function ClientLayout() {
  const { error: storeError, reload } = useStore()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return (
    <div className="rg-client">
      <Announcement />
      <Nav />
      <main data-page={pathname.split('/')[1] || 'home'}>
        {storeError && <div className="notice error" role="alert">{storeError} <button type="button" className="linkbtn" onClick={() => void reload()}>Try again</button></div>}
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
