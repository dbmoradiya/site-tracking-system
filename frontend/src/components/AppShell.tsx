import { Building2, LayoutDashboard, LogOut, Menu, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/setup', label: 'Setup', icon: Settings, adminOnly: true },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const links = navigation.filter(item => !item.adminOnly || user?.role === 'ADMIN')
  useEffect(() => {
    setOpen(false)
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="mobile-header">
      <button className="icon-button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu aria-hidden="true" /></button>
      <Brand />
      <span className="avatar" aria-label={`${user?.name}, ${user?.role}`}>{user?.name.slice(0, 2).toUpperCase()}</span>
    </header>
    {open && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar__top">
        <Brand />
        <button className="icon-button sidebar__close" onClick={() => setOpen(false)} aria-label="Close navigation"><X aria-hidden="true" /></button>
      </div>
      <nav className="sidebar__nav" aria-label="Primary navigation">
        {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar__profile">
        <span className="avatar">{user?.name.slice(0, 2).toUpperCase()}</span>
        <div><strong>{user?.name}</strong><span>{user?.role.toLowerCase()}</span></div>
        <button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut aria-hidden="true" /></button>
      </div>
    </aside>
    <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>{children}</main>
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {links.slice(0, 4).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}>
        <Icon aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
    </nav>
  </div>
}

function Brand() {
  return <div className="brand"><span className="brand__mark">ST</span><span>SiteTrack</span></div>
}
