export default function Icon({ name }: { name: 'search' | 'heart' | 'user' | 'bag' | 'cart' | 'menu' | 'leaf' | 'spark' | 'truck' | 'mail' | 'phone' | 'pin' | 'arrow' }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" /></>,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    leaf: <><path d="M20 3C9 2 3 8 5 15c7 3 16-2 15-12Z" /><path d="m3 21 12-12" /></>,
    spark: <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" />,
    truck: <><path d="M2 5h12v12H2zM14 9h4l4 5v3h-8" /><circle cx="6" cy="18" r="2" fill="var(--bg)" /><circle cx="18" cy="18" r="2" fill="var(--bg)" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    phone: <path d="M8 3H4v3c0 8 6 14 14 14h3v-4l-5-2-2 3a13 13 0 0 1-7-7l3-2-2-5Z" />,
    pin: <><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    cart: <><path d="M2 3h3l3 12h11l3-9H6M8 15l-1 3h12"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  }
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

