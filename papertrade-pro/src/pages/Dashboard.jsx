import { useState, useMemo } from 'react'
import { useMarketData, ALL_INSTRUMENTS, getInstrument } from '../context/MarketDataContext'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fmtINR, fmtNum } from '../lib/format'
import PriceChart from '../components/PriceChart'

export default function Dashboard() {
  const { prices } = useMarketData()
  const {
    positions, orders, watchlist,
    addToWatchlist, removeFromWatchlist,
    upsertPosition, removePosition, recordOrder, updateCash,
  } = usePortfolio()
  const { profile } = useAuth()
  const { showToast } = useToast()

  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE')
  const [side, setSide] = useState('BUY')
  const [orderType, setOrderType] = useState('MARKET')
  const [qty, setQty] = useState(1)
  const [limitPrice, setLimitPrice] = useState('')
  const [activeTab, setActiveTab] = useState('positions')
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmExit, setConfirmExit] = useState(null)
  const [placing, setPlacing] = useState(false)

  const cash = profile?.cash ?? 0
  const selectedStock = getInstrument(selectedSymbol)
  const selectedPrice = prices[selectedSymbol]

  const portfolioStats = useMemo(() => {
    let currentValue = 0
    let unrealizedPnl = 0
    positions.forEach(p => {
      const cp = prices[p.symbol]?.ltp ?? p.avg_price
      const mult = p.side === 'BUY' ? 1 : -1
      currentValue += cp * p.qty
      unrealizedPnl += (cp - p.avg_price) * p.qty * mult
    })
    return { currentValue, unrealizedPnl, netWorth: cash + currentValue }
  }, [positions, prices, cash])

  function executePrice() {
    if (orderType === 'MARKET') return selectedPrice?.ltp ?? 0
    const lp = parseFloat(limitPrice)
    return isNaN(lp) ? (selectedPrice?.ltp ?? 0) : lp
  }
  const orderValue = () => executePrice() * qty
  const brokerage = () => Math.min(20, orderValue() * 0.0003)
  const totalCost = () => orderValue() + brokerage()

  function canPlaceOrder() {
    if (!selectedPrice || qty < 1) return false
    if (orderType === 'LIMIT' && (!limitPrice || parseFloat(limitPrice) <= 0)) return false
    if (side === 'BUY' && totalCost() > cash) return false
    return true
  }

  async function placeOrder() {
    if (!canPlaceOrder() || placing) {
      showToast('Order rejected', side === 'BUY' ? 'Insufficient funds' : 'Check order details', true)
      return
    }
    setPlacing(true)
    try {
      const execPrice = executePrice()
      const cost = execPrice * qty
      const fee = Math.min(20, cost * 0.0003)
      let realizedPnl = 0
      const existing = positions.find(p => p.symbol === selectedSymbol)

      if (!existing) {
        await upsertPosition({ symbol: selectedSymbol, qty, avg_price: execPrice, side })
      } else if (existing.side === side) {
        const newQty = existing.qty + qty
        const newAvg = (existing.avg_price * existing.qty + execPrice * qty) / newQty
        await upsertPosition({ id: existing.id, symbol: selectedSymbol, qty: newQty, avg_price: newAvg, side: existing.side })
      } else {
        const mult = existing.side === 'BUY' ? 1 : -1
        if (qty < existing.qty) {
          realizedPnl = (execPrice - existing.avg_price) * qty * mult
          await upsertPosition({ id: existing.id, symbol: selectedSymbol, qty: existing.qty - qty, avg_price: existing.avg_price, side: existing.side })
        } else if (qty === existing.qty) {
          realizedPnl = (execPrice - existing.avg_price) * qty * mult
          await removePosition(existing.id)
        } else {
          realizedPnl = (execPrice - existing.avg_price) * existing.qty * mult
          await upsertPosition({ id: existing.id, symbol: selectedSymbol, qty: qty - existing.qty, avg_price: execPrice, side })
        }
      }

      const cashDelta = side === 'BUY' ? -(cost + fee) : (cost - fee)
      await updateCash(cashDelta)
      await recordOrder({
        instrument_type: 'EQUITY',
        symbol: selectedSymbol,
        exchange: selectedStock.exch,
        side,
        qty,
        price: execPrice,
        order_type: orderType,
        realized_pnl: realizedPnl,
      })

      showToast(`${side === 'BUY' ? 'Bought' : 'Sold'} ${qty} ${selectedSymbol}`, `@ ${fmtINR(execPrice)} · ${orderType}`)
      setQty(1)
      setLimitPrice('')
    } finally {
      setPlacing(false)
    }
  }

  async function closePosition(pos) {
    const cp = prices[pos.symbol]?.ltp ?? pos.avg_price
    const mult = pos.side === 'BUY' ? 1 : -1
    const pnl = (cp - pos.avg_price) * pos.qty * mult
    const proceeds = cp * pos.qty
    const fee = Math.min(20, proceeds * 0.0003)

    await updateCash(pos.side === 'BUY' ? proceeds - fee : -proceeds - fee)
    await removePosition(pos.id)
    await recordOrder({
      instrument_type: 'EQUITY',
      symbol: pos.symbol,
      exchange: getInstrument(pos.symbol)?.exch ?? 'NSE',
      side: pos.side === 'BUY' ? 'SELL' : 'BUY',
      qty: pos.qty,
      price: cp,
      order_type: 'MARKET',
      realized_pnl: pnl,
    })
    showToast(`Closed ${pos.symbol}`, `P&L: ${pnl >= 0 ? '+' : ''}${fmtINR(pnl)}`, pnl < 0)
    setConfirmExit(null)
  }

  const searchResults = searchQuery
    ? ALL_INSTRUMENTS.filter(s =>
        !watchlist.includes(s.symbol) &&
        (s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 6)
    : []

  return (
    <div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Available cash</div>
          <div className="metric-value">{fmtINR(cash)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net worth</div>
          <div className="metric-value" style={{ color: portfolioStats.netWorth >= (profile?.starting_cash ?? cash) ? 'var(--green)' : 'var(--red)' }}>
            {fmtINR(portfolioStats.netWorth)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Unrealized P&amp;L</div>
          <div className={`metric-value ${portfolioStats.unrealizedPnl >= 0 ? 'up' : 'down'}`}>
            {portfolioStats.unrealizedPnl >= 0 ? '+' : ''}{fmtINR(portfolioStats.unrealizedPnl)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open positions</div>
          <div className="metric-value">{positions.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 14 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Watchlist</div>
            <input placeholder="Search NSE/BSE..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div>
            {watchlist.map(sym => {
              const s = getInstrument(sym)
              const p = prices[sym]
              if (!s || !p) return null
              const chg = p.ltp - p.prevClose
              const chgPct = (chg / p.prevClose) * 100
              const isUp = chg >= 0
              return (
                <div
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', cursor: 'pointer',
                    borderLeft: selectedSymbol === sym ? '2px solid var(--amber)' : '2px solid transparent',
                    background: selectedSymbol === sym ? 'var(--panel-2)' : 'transparent',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{sym}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{s.exch}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 13, fontWeight: 600 }}>{fmtNum(p.ltp)}</div>
                    <div className={`num ${isUp ? 'up' : 'down'}`} style={{ fontSize: 10.5 }}>{isUp ? '+' : ''}{fmtNum(chgPct)}%</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromWatchlist(sym) }}
                    style={{ color: 'var(--text-faint)', fontSize: 15, padding: '2px 4px' }}
                  >×</button>
                </div>
              )
            })}
          </div>
          {searchQuery && (
            <div style={{ borderTop: '1px dashed var(--border)', padding: 10 }}>
              {searchResults.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-faint)', padding: '6px 4px' }}>No matches</div>}
              {searchResults.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => { addToWatchlist(s.symbol); setSearchQuery('') }}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 4px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 12 }}>{s.symbol}</span>
                  <span style={{ color: 'var(--amber)' }}>+</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {selectedStock && selectedPrice && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{selectedStock.symbol}</span>
                <span className="exch-badge">{selectedStock.exch}</span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{selectedStock.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 12px' }}>
                <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>₹{fmtNum(selectedPrice.ltp)}</span>
                {(() => {
                  const chg = selectedPrice.ltp - selectedPrice.prevClose
                  const chgPct = (chg / selectedPrice.prevClose) * 100
                  const isUp = chg >= 0
                  return (
                    <span className={`num ${isUp ? 'up' : 'down'}`} style={{ fontSize: 13, fontWeight: 600 }}>
                      {isUp ? '+' : ''}{fmtNum(chg)} ({isUp ? '+' : ''}{fmtNum(chgPct)}%)
                    </span>
                  )
                })()}
              </div>
              <PriceChart symbol={selectedSymbol} timeframe="1m" height={240} />
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', gap: 2, padding: '10px 14px 0' }}>
              <button
                className="nav-link"
                style={activeTab === 'positions' ? { color: 'var(--amber)', background: 'var(--amber-bg)' } : {}}
                onClick={() => setActiveTab('positions')}
              >
                Positions {positions.length > 0 && `(${positions.length})`}
              </button>
              <button
                className="nav-link"
                style={activeTab === 'orders' ? { color: 'var(--amber)', background: 'var(--amber-bg)' } : {}}
                onClick={() => setActiveTab('orders')}
              >
                Order history
              </button>
            </div>
            <div style={{ padding: 14 }}>
              {activeTab === 'positions' && (
                positions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">◇</div>
                    No open positions yet. Place your first order to get started.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Symbol</th><th>Side</th><th className="right">Qty</th>
                        <th className="right">Avg. price</th><th className="right">LTP</th>
                        <th className="right">P&amp;L</th><th className="right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(p => {
                        const cp = prices[p.symbol]?.ltp ?? p.avg_price
                        const mult = p.side === 'BUY' ? 1 : -1
                        const pnl = (cp - p.avg_price) * p.qty * mult
                        const pnlPct = ((cp - p.avg_price) / p.avg_price) * 100 * mult
                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setSelectedSymbol(p.symbol)}>{p.symbol}</td>
                            <td><span className={`side-badge ${p.side === 'BUY' ? 'buy' : 'sell'}`}>{p.side}</span></td>
                            <td className="right mono">{p.qty}</td>
                            <td className="right mono">{fmtNum(p.avg_price)}</td>
                            <td className="right mono">{fmtNum(cp)}</td>
                            <td className={`right mono ${pnl >= 0 ? 'up' : 'down'}`}>
                              {pnl >= 0 ? '+' : ''}{fmtINR(pnl)}
                              <div style={{ fontSize: 10 }}>{pnl >= 0 ? '+' : ''}{fmtNum(pnlPct)}%</div>
                            </td>
                            <td className="right"><button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setConfirmExit(p)}>Exit</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              )}
              {activeTab === 'orders' && (
                orders.filter(o => o.instrument_type === 'EQUITY').length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">◇</div>
                    No orders placed yet.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Time</th><th>Symbol</th><th>Side</th><th className="right">Qty</th><th className="right">Price</th><th>Type</th></tr>
                    </thead>
                    <tbody>
                      {orders.filter(o => o.instrument_type === 'EQUITY').map(o => (
                        <tr key={o.id}>
                          <td className="mono" style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                            {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontWeight: 500 }}>{o.symbol}</td>
                          <td><span className={`side-badge ${o.side === 'BUY' ? 'buy' : 'sell'}`}>{o.side}</span></td>
                          <td className="right mono">{o.qty}</td>
                          <td className="right mono">₹{fmtNum(o.price)}</td>
                          <td className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{o.order_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>

        <div className="card">
          {selectedStock && selectedPrice && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedStock.symbol}</div>
                <div className="num" style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>₹{fmtNum(selectedPrice.ltp)} · {selectedStock.exch}</div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button className={side === 'BUY' ? 'btn btn-buy' : 'btn'} style={{ flex: 1 }} onClick={() => setSide('BUY')}>BUY</button>
                <button className={side === 'SELL' ? 'btn btn-sell' : 'btn'} style={{ flex: 1 }} onClick={() => setSide('SELL')}>SELL</button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button className="btn" style={{ flex: 1, fontSize: 11, ...(orderType === 'MARKET' ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }} onClick={() => setOrderType('MARKET')}>Market</button>
                <button className="btn" style={{ flex: 1, fontSize: 11, ...(orderType === 'LIMIT' ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }} onClick={() => setOrderType('LIMIT')}>Limit</button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Quantity</label>
                  <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <button style={{ padding: '7px 11px' }} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                    <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ border: 'none', textAlign: 'center' }} />
                    <button style={{ padding: '7px 11px' }} onClick={() => setQty(q => q + 1)}>+</button>
                  </div>
                </div>
                {orderType === 'LIMIT' && (
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Limit price</label>
                    <input type="number" step="0.05" placeholder={fmtNum(selectedPrice.ltp)} value={limitPrice} onChange={e => setLimitPrice(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--panel-2)', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 11.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-faint)' }}>Order value</span>
                  <span className="mono">{fmtINR(orderValue())}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-faint)' }}>Brokerage (est.)</span>
                  <span className="mono">{fmtINR(brokerage())}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 600 }}>
                  <span>Total {side === 'BUY' ? 'payable' : 'receivable'}</span>
                  <span className="mono" style={{ fontSize: 13 }}>{fmtINR(totalCost())}</span>
                </div>
              </div>

              <button
                className={side === 'BUY' ? 'btn btn-buy' : 'btn btn-sell'}
                style={{ width: '100%', padding: 12 }}
                disabled={!canPlaceOrder() || placing}
                onClick={placeOrder}
              >
                {placing ? 'Placing…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${selectedStock.symbol}`}
              </button>
              <div style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-faint)', marginTop: 8 }}>
                Available margin: {fmtINR(cash)}
              </div>
            </>
          )}
        </div>
      </div>

      {confirmExit && (
        <div className="modal-overlay" onClick={() => setConfirmExit(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Exit position?</div>
            <div className="modal-body">
              Close {confirmExit.qty} {confirmExit.symbol} at market price ₹{fmtNum(prices[confirmExit.symbol]?.ltp)}?
            </div>
            <div className="modal-actions">
              <button className="cancel" onClick={() => setConfirmExit(null)}>Cancel</button>
              <button className="confirm" onClick={() => closePosition(confirmExit)}>Confirm exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
