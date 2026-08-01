import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fmtINR } from '../lib/format'
import { useTheme } from '../context/ThemeContext'
import InstrumentSearch from './InstrumentSearch'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/options', label: 'Options' },
  { to: '/charts', label: 'Charts' },
  { to: '/news', label: 'News' },
  { to: '/journal', label: 'Journal' },
]

export default function Navbar() {
  const { profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initials = (profile?.full_name || 'PT')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <button className="hamburger-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <div className="brand-mark">PT</div>
          <span className="brand-name">PaperTrade</span>
        </div>

        <div className="nav-links">
          {LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="topbar-search"><InstrumentSearch variant="desktop" /></div>

        <div className="topbar-right">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle dark/light theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <div className="fund-chip">
            <div className="fund-label">Cash</div>
            <div className="fund-value">{fmtINR(profile?.cash ?? 0)}</div>
          </div>
          <NavLink to="/profile" className="avatar-btn" title="Profile">
            {initials}
          </NavLink>
        </div>
      </div>

      <div className="mobile-search"><InstrumentSearch variant="mobile" /></div>

      {mobileOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            {LINKS.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `mobile-menu-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/profile" className="mobile-menu-link" onClick={() => setMobileOpen(false)}>
              Profile
            </NavLink>
          </div>
        </div>
      )}
    </>
  )
}
