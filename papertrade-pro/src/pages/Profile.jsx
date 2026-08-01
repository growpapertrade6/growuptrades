import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePortfolio } from '../context/PortfolioContext'
import { useMarketData } from '../context/MarketDataContext'
import { useToast } from '../context/ToastContext'
import { fmtINR } from '../lib/format'

export default function Profile() {
  const { user, profile, signOut } = useAuth()
  const { positions, optionPositions, orders, resetAccount } = usePortfolio()
  const { prices } = useMarketData()
  const { showToast } = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  const stats = useMemo(() => {
    const realized = orders.reduce((sum, o) => sum + (o.realized_pnl || 0), 0)
    const closedTrades = orders.filter(o => o.realized_pnl && o.realized_pnl !== 0)
    const wins = closedTrades.filter(o => o.realized_pnl > 0).length
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : null

    let unrealized = 0
    positions.forEach(p => {
      const cp = prices[p.symbol]?.ltp ?? p.avg_price
      const mult = p.side === 'BUY' ? 1 : -1
      unrealized += (cp - p.avg_price) * p.qty * mult
    })

    return { realized, winRate, closedCount: closedTrades.length, unrealized }
  }, [orders, positions, prices])

  const netWorth = (profile?.cash ?? 0) + positions.reduce((sum, p) => {
    const cp = prices[p.symbol]?.ltp ?? p.avg_price
    return sum + cp * p.qty
  }, 0)

  async function handleReset() {
    await resetAccount()
    setConfirmReset(false)
    showToast('Account reset', `Starting cash restored to ${fmtINR(profile?.starting_cash ?? 1000000)}`)
  }

  const initials = (profile?.full_name || 'PT').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div className="avatar-btn" style={{ width: 56, height: 56, fontSize: 18 }}>{initials}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{profile?.full_name || 'Trader'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{user?.email}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
            Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Net worth</div>
          <div className="metric-value">{fmtINR(netWorth)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Realized P&amp;L</div>
          <div className={`metric-value ${stats.realized >= 0 ? 'up' : 'down'}`}>{stats.realized >= 0 ? '+' : ''}{fmtINR(stats.realized)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Unrealized P&amp;L</div>
          <div className={`metric-value ${stats.unrealized >= 0 ? 'up' : 'down'}`}>{stats.unrealized >= 0 ? '+' : ''}{fmtINR(stats.unrealized)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Win rate</div>
          <div className="metric-value">{stats.winRate === null ? '—' : `${stats.winRate.toFixed(0)}%`}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Account</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-faint)' }}>Starting cash</span>
            <span className="mono">{fmtINR(profile?.starting_cash ?? 1000000)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-faint)' }}>Available cash</span>
            <span className="mono">{fmtINR(profile?.cash ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-faint)' }}>Open equity positions</span>
            <span className="mono">{positions.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-faint)' }}>Open option positions</span>
            <span className="mono">{optionPositions.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-faint)' }}>Total orders placed</span>
            <span className="mono">{orders.length}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Reset account</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>Clears all positions and orders, restores starting cash.</div>
        </div>
        <button className="btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setConfirmReset(true)}>Reset</button>
      </div>

      <button className="btn" onClick={signOut}>Sign out</button>

      {confirmReset && (
        <div className="modal-overlay" onClick={() => setConfirmReset(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Reset account?</div>
            <div className="modal-body">
              This clears all positions, option positions, and order history, and restores your virtual cash to {fmtINR(profile?.starting_cash ?? 1000000)}. This cannot be undone.
            </div>
            <div className="modal-actions">
              <button className="cancel" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="confirm" onClick={handleReset}>Reset account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
