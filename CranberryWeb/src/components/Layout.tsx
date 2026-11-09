import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BookOpen, Home, LogOut, PenLine, Settings } from 'lucide-react'
import { Brand } from './Brand'
import { useAuth } from '../auth/AuthContext'

const links = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const initial = profile?.userName?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <button className="btn btn-primary btn-block sidebar-cta" onClick={() => navigate('/journal/new')}>
          <PenLine size={16} />
          <span>Reflect</span>
        </button>
        <nav>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initial}</span>
          <span className="sidebar-user-name">{profile?.userName}</span>
          <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Brand />
        <span className="avatar">{initial}</span>
      </header>

      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <nav className="tabbar">
        {links.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/journal/new" className="tab tab-fab" aria-label="Reflect on today">
          <PenLine size={20} />
        </NavLink>
        {links.slice(2).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
