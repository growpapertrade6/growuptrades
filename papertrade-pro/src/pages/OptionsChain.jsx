import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMarketData, INDEX_UNIVERSE, STOCK_UNIVERSE, getInstrument } from '../context/MarketDataContext'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fmtINR, fmtNum } from '../lib/format'
import { isMarketOpen, marketClosedReason } from '../lib/marketHours'
import { nextExpiries, generateChain, lotSizeFor, blackScholes } from '../lib/optionsEngine'

const UNDERLYINGS = [...INDEX_UNIVERSE, ...STOCK_UNIVERSE]

export default function OptionsChain() {
  const { prices } = useMarketData()
  const { optionPositions, upsertOptionPosition, removeOptionPosition, recordOrder, updateCash } = usePortfolio()
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [underlyingSym, setUnderlyingSym] = useState(() => {
    const fromUrl = searchParams.get('underlying')
    return (fromUrl && getInstrument(fromUrl)) ? fromUrl : 'NIFTY50'
  })
  const expiries = useMemo(() => nextExpiries(4), [])
  const [expiryIdx, setExpiryIdx] = useState(0)
  const [leg, setLeg] = useState(null)
  const [side, setSide] = useState('BUY')
  const [lots, setLots] = useState(1)
  const [confirmExit, setConfirmExit] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [pendingDeepLink, setPendingDeepLink] = useState(() => {
    const strike = searchParams.get('strike')
    const type = searchParams.get('type')
    return strike && type ? { strike: Number(strike), type } : null
  })

  const underlying = getInstrument(underlyingSym)
  const spot = prices[underlyingSym]?.ltp ?? underlying?.base
  const expiry = expiries[expiryIdx]
  const lotSize = lotSizeFor(underlying)
  const cash = profile?.cash ?? 0

  const chain = useMemo(() => {
    if (!underlying || !spot) return []
    return generateChain(underlying, spot, expiry)
  }, [underlying, spot, expiry])

  // If the global search bar deep-linked here (e.g. "NIFTY 24000 CE"), jump
  // to that underlying and, once its chain is ready, open the nearest
  // matching strike as the order leg.
  useEffect(() => {
    const urlUnderlying = searchParams.get('underlying')
    if (urlUnderlying && getInstrument(urlUnderlying)) setUnderlyingSym(urlUnderlying)
    if (searchParams.toString()) setSearchParams({}, { replace: true })
  }, [])

  useEffect(() => {
    if (!pendingDeepLink || chain.length === 0) return
    const nearest = chain.reduce((best, row) =>
      Math.abs(row.strike - pendingDeepLink.strike) < Math.abs(best.strike - pendingDeepLink.strike) ? row : best
    )
    const premium = pendingDeepLink.type === 'CE' ? nearest.ce : nearest.pe
    openLeg(nearest.strike, pendingDeepLink.type, premium)
    setPendingDeepLink(null)
  }, [pendingDeepLink, chain])

  function openLeg(strike, type, premium) {
    setLeg({ strike, type, premium })
    setSide('BUY')
    setLots(1)
  }

  const premiumValue = () => (leg?.premium ?? 0) * lots * lotSize
  const brokerage = () => Math.min(20, premiumValue() * 0.0003)
  const totalCost = () => premiumValue() + brokerage()

  function canPlace() {
    if (!isMarketOpen()) return false
    if (!leg || lots < 1) return false
    if (side === 'BUY' && totalCost() > cash) return false
    return true
  }

  async function placeOptionOrder() {
    if (!isMarketOpen()) {
      showToast('Order rejected', marketClosedReason(), true)
      return
    }
    if (!canPlace() || placing) {
      showToast('Order rejected', 'Insufficient funds', true)
      return
    }
    setPlacing(true)
    try {
      const premium = leg.premium
      const notional = premium * lots * lotSize
      const fee = Math.min(20, notional * 0.0003)
      let realizedPnl = 0
      const expiryStr = expiry.toISOString().slice(0, 10)

      const existing = optionPositions.find(p =>
        p.underlying === underlyingSym && p.strike === leg.strike &&
        p.option_type === leg.type && p.expiry === expiryStr
      )

      if (!existing) {
        await upsertOptionPosition({
          underlying: underlyingSym, exchange: underlying.exch, strike: leg.strike,
          expiry: expiryStr, option_type: leg.type,
          lots, lot_size: lotSize, avg_premium: premium, side,
        })
      } else if (existing.side === side) {
        const newLots = existing.lots + lots
        const newAvg = (existing.avg_premium * existing.lots + premium * lots) / newLots
        await upsertOptionPosition({ id: existing.id, lots: newLots, avg_premium: newAvg })
      } else {
        const mult = existing.side === 'BUY' ? 1 : -1
        if (lots < existing.lots) {
          realizedPnl = (premium - existing.avg_premium) * lots * lotSize * mult
          await upsertOptionPosition({ id: existing.id, lots: existing.lots - lots })
        } else if (lots === existing.lots) {
          realizedPnl = (premium - existing.avg_premium) * lots * lotSize * mult
          await removeOptionPosition(existing.id)
        } else {
          realizedPnl = (premium - existing.avg_premium) * existing.lots * lotSize * mult
          await upsertOptionPosition({ id: existing.id, lots: lots - existing.lots, avg_premium: premium, side })
        }
      }

      const cashDelta = side === 'BUY' ? -(notional + fee) : (notional - fee)
      await updateCash(cashDelta)
      await recordOrder({
        instrument_type: 'OPTION',
        symbol: `${underlyingSym} ${leg.strike} ${leg.type}`,
        exchange: underlying.exch,
        side, qty: lots * lotSize, price: premium, order_type: 'MARKET',
        strike: leg.strike, expiry: expiryStr, option_type: leg.type,
        realized_pnl: realizedPnl,
      })

      showToast(`${side === 'BUY' ? 'Bought' : 'Sold'} ${lots} lot(s) ${underlyingSym} ${leg.strike} ${leg.type}`, `@ ₹${fmtNum(premium)}`)
      setLeg(null)
    } finally {
      setPlacing(false)
    }
  }

  async function closeOptionPosition(pos) {
    if (!isMarketOpen()) {
      showToast('Order rejected', marketClosedReason(), true)
      setConfirmExit(null)
      return
    }
    const inst = getInstrument(pos.underlying)
    const sp = prices[pos.underlying]?.ltp ?? inst.base
    const daysToExpiry = Math.max(0.5, (new Date(pos.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const cp = blackScholes(sp, pos.strike, daysToExpiry, inst.iv, pos.option_type)
    const mult = pos.side === 'BUY' ? 1 : -1
    const pnl = (cp - pos.avg_premium) * pos.lots * pos.lot_size * mult
    const proceeds = cp * pos.lots * pos.lot_size
    const fee = Math.min(20, proceeds * 0.0003)

    await updateCash(pos.side === 'BUY' ? proceeds - fee : -proceeds - fee)
    await removeOptionPosition(pos.id)
    await recordOrder({
      instrument_type: 'OPTION',
      symbol: `${pos.underlying} ${pos.strike} ${pos.option_type}`,
      exchange: inst.exch,
      side: pos.side === 'BUY' ? 'SELL' : 'BUY',
      qty: pos.lots * pos.lot_size,
      price: cp,
      order_type: 'MARKET',
      strike: pos.strike, expiry: pos.expiry, option_type: pos.option_type,
      realized_pnl: pnl,
    })
    showToast(`Closed ${pos.underlying} ${pos.strike} ${pos.option_type}`, `P&L: ${pnl >= 0 ? '+' : ''}${fmtINR(pnl)}`, pnl < 0)
    setConfirmExit(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={underlyingSym} onChange={e => setUnderlyingSym(e.target.value)} style={{ width: 200 }}>
          <optgroup label="Index">
            {INDEX_UNIVERSE.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
          </optgroup>
          <optgroup label="Stocks">
            {STOCK_UNIVERSE.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
          </optgroup>
        </select>

        <div style={{ display: 'flex', gap: 4 }}>
          {expiries.map((exp, i) => (
            <button
              key={i}
              className="btn"
              style={{ fontSize: 11.5, padding: '7px 12px', ...(i === expiryIdx ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
              onClick={() => setExpiryIdx(i)}
            >
              {exp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Spot · Lot size {lotSize}</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>₹{fmtNum(spot)}</div>
        </div>
      </div>

      {!isMarketOpen() && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 6, padding: '10px 12px', marginBottom: 16, fontSize: 11.5, color: 'var(--red)', lineHeight: 1.5 }}>
          Market closed · NSE/BSE F&amp;O hours: Mon–Fri, 9:15 AM – 3:30 PM IST. Orders can't be placed right now.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th className="right">CE LTP</th>
                <th className="right" style={{ width: 60 }}>Buy/Sell</th>
                <th style={{ textAlign: 'center' }}>Strike</th>
                <th style={{ width: 60 }}>Buy/Sell</th>
                <th>PE LTP</th>
              </tr>
            </thead>
            <tbody>
              {chain.map(row => (
                <tr key={row.strike} style={row.isATM ? { background: 'var(--amber-bg)' } : {}}>
                  <td className="right mono" style={{ fontWeight: 600 }}>{fmtNum(row.ce)}</td>
                  <td className="right">
                    <button className="btn btn-buy" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => openLeg(row.strike, 'CE', row.ce)}>B</button>
                  </td>
                  <td className="mono" style={{ textAlign: 'center', fontWeight: 700, color: row.isATM ? 'var(--amber)' : 'var(--text)' }}>{row.strike}</td>
                  <td>
                    <button className="btn btn-sell" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => openLeg(row.strike, 'PE', row.pe)}>S</button>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{fmtNum(row.pe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          {!leg ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <div className="empty-state-icon">◇</div>
              Tap B or S next to any strike to build an order.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{underlyingSym} {leg.strike} {leg.type}</div>
                <div className="num" style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                  Premium ₹{fmtNum(leg.premium)} · Exp {expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button className={side === 'BUY' ? 'btn btn-buy' : 'btn'} style={{ flex: 1 }} onClick={() => setSide('BUY')}>BUY</button>
                <button className={side === 'SELL' ? 'btn btn-sell' : 'btn'} style={{ flex: 1 }} onClick={() => setSide('SELL')}>SELL</button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Lots (1 lot = {lotSize} qty)</label>
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <button style={{ padding: '7px 11px' }} onClick={() => setLots(l => Math.max(1, l - 1))}>−</button>
                  <input type="number" min="1" value={lots} onChange={e => setLots(Math.max(1, parseInt(e.target.value) || 1))} style={{ border: 'none', textAlign: 'center' }} />
                  <button style={{ padding: '7px 11px' }} onClick={() => setLots(l => l + 1)}>+</button>
                </div>
              </div>

              <div style={{ background: 'var(--panel-2)', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 11.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-faint)' }}>Premium value</span>
                  <span className="mono">{fmtINR(premiumValue())}</span>
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
                disabled={!canPlace() || placing}
                onClick={placeOptionOrder}
              >
                {placing ? 'Placing…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${leg.type}`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div style={{ padding: '14px 14px 0' }}>
          <div className="section-title">Option positions</div>
        </div>
        <div style={{ padding: 14 }}>
          {optionPositions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◇</div>
              No open option positions.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contract</th><th>Side</th><th className="right">Lots</th>
                  <th className="right">Avg premium</th><th className="right">LTP</th>
                  <th className="right">P&amp;L</th><th className="right"></th>
                </tr>
              </thead>
              <tbody>
                {optionPositions.map(p => {
                  const inst = getInstrument(p.underlying)
                  const sp = prices[p.underlying]?.ltp ?? inst.base
                  const daysToExpiry = Math.max(0.5, (new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  const cp = blackScholes(sp, p.strike, daysToExpiry, inst.iv, p.option_type)
                  const mult = p.side === 'BUY' ? 1 : -1
                  const pnl = (cp - p.avg_premium) * p.lots * p.lot_size * mult
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.underlying} {p.strike} {p.option_type}
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 400 }}>
                          Exp {new Date(p.expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      </td>
                      <td><span className={`side-badge ${p.side === 'BUY' ? 'buy' : 'sell'}`}>{p.side}</span></td>
                      <td className="right mono">{p.lots}</td>
                      <td className="right mono">{fmtNum(p.avg_premium)}</td>
                      <td className="right mono">{fmtNum(cp)}</td>
                      <td className={`right mono ${pnl >= 0 ? 'up' : 'down'}`}>{pnl >= 0 ? '+' : ''}{fmtINR(pnl)}</td>
                      <td className="right"><button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setConfirmExit(p)}>Exit</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmExit && (
        <div className="modal-overlay" onClick={() => setConfirmExit(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Exit position?</div>
            <div className="modal-body">
              Close {confirmExit.lots} lot(s) of {confirmExit.underlying} {confirmExit.strike} {confirmExit.option_type} at current premium?
            </div>
            <div className="modal-actions">
              <button className="cancel" onClick={() => setConfirmExit(null)}>Cancel</button>
              <button className="confirm" onClick={() => closeOptionPosition(confirmExit)}>Confirm exit</button>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 14, lineHeight: 1.6 }}>
        Premiums are computed with a Black-Scholes model against the simulated spot price — they approximate real option pricing but won't exactly match live NSE/BSE quotes. Expiry dates and stock-option lot sizes shown here are illustrative for practice; always check the current NSE circular for real contract specs.
      </p>
    </div>
  )
}
