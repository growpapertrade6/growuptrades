import { useState } from 'react'
import { useMarketData, ALL_INSTRUMENTS, getInstrument } from '../context/MarketDataContext'
import PriceChart from '../components/PriceChart'
import { fmtNum } from '../lib/format'

const TIMEFRAMES = ['1m', '5m', '15m', '1H']

export default function ChartView() {
  const { prices } = useMarketData()
  const [symbol, setSymbol] = useState('NIFTY50')
  const [timeframe, setTimeframe] = useState('5m')
  const [searchQuery, setSearchQuery] = useState('')

  const instrument = getInstrument(symbol)
  const price = prices[symbol]

  const results = searchQuery
    ? ALL_INSTRUMENTS.filter(s =>
        s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 240 }}>
          <input placeholder="Search symbol..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {results.length > 0 && (
            <div className="card" style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 10, padding: 6 }}>
              {results.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => { setSymbol(s.symbol); setSearchQuery('') }}
                  style={{ padding: '7px 8px', cursor: 'pointer', borderRadius: 4 }}
                >
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{s.symbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 8 }}>{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {instrument && price && (
          <>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{instrument.symbol} <span className="exch-badge">{instrument.exch}</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{instrument.name}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>₹{fmtNum(price.ltp)}</span>
              {(() => {
                const chg = price.ltp - price.prevClose
                const chgPct = (chg / price.prevClose) * 100
                const isUp = chg >= 0
                return (
                  <span className={`num ${isUp ? 'up' : 'down'}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    {isUp ? '+' : ''}{fmtNum(chg)} ({isUp ? '+' : ''}{fmtNum(chgPct)}%)
                  </span>
                )
              })()}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            className="btn"
            style={{ fontSize: 11.5, padding: '6px 14px', ...(timeframe === tf ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
            onClick={() => setTimeframe(tf)}
          >{tf}</button>
        ))}
      </div>

      <div className="card">
        <PriceChart symbol={symbol} timeframe={timeframe} height={520} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {ALL_INSTRUMENTS.map(s => (
          <button
            key={s.symbol}
            className="btn"
            style={{ fontSize: 11, padding: '5px 10px', ...(s.symbol === symbol ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
            onClick={() => setSymbol(s.symbol)}
          >{s.symbol}</button>
        ))}
      </div>
    </div>
  )
}
