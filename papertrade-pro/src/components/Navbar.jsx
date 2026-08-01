import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fmtINR } from '../lib/format'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/options', label: 'Options' },
  { to: '/charts', label: 'Charts' },
  { to: '/news', label: 'News' },
  { to: '/journal', label: 'Journal' },
]

export default function Navbar() {
  const { profile } = useAuth()
  const initials = (profile?.full_name || 'PT')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="topbar">
      <div className="brand">
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

      <div className="topbar-right">
        <div className="fund-chip">
          <div className="fund-label">Cash</div>
          <div className="fund-value">{fmtINR(profile?.cash ?? 0)}</div>
        </div>
        <NavLink to="/profile" className="avatar-btn" title="Profile">
          {initials}
        </NavLink>
      </div>
    </div>
  )
}
