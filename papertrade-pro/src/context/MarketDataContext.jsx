import { createContext, useContext, useEffect, useState } from 'react'

// Base prices are a manually-refreshed snapshot (last checked: Aug 2026) —
// this is a simulator, not a live feed, so these will drift from the real
// market over time. Re-check against NSE/BSE periodically and update here.
// (Some stocks — e.g. RELIANCE — had gone stale here after a stock split,
// which is why the app was showing ~₹2,900 for a stock actually near ₹1,300.)
export const STOCK_UNIVERSE = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', exch: 'NSE', base: 1300.00, vol: 0.006, iv: 0.22 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exch: 'NSE', base: 2432.00, vol: 0.005, iv: 0.20 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exch: 'NSE', base: 748.20, vol: 0.007, iv: 0.21 },
  { symbol: 'INFY', name: 'Infosys', exch: 'NSE', base: 1155.60, vol: 0.006, iv: 0.23 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exch: 'NSE', base: 1433.90, vol: 0.007, iv: 0.22 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exch: 'NSE', base: 1698.75, vol: 0.008, iv: 0.24 },
  { symbol: 'SBIN', name: 'State Bank of India', exch: 'NSE', base: 1027.40, vol: 0.009, iv: 0.26 },
  { symbol: 'ITC', name: 'ITC Limited', exch: 'NSE', base: 301.45, vol: 0.005, iv: 0.19 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exch: 'NSE', base: 700.00, vol: 0.012, iv: 0.32 },
  { symbol: 'WIPRO', name: 'Wipro', exch: 'NSE', base: 186.33, vol: 0.008, iv: 0.25 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', exch: 'NSE', base: 2282.00, vol: 0.015, iv: 0.38 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', exch: 'NSE', base: 13500.00, vol: 0.007, iv: 0.23 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', exch: 'NSE', base: 1782.65, vol: 0.006, iv: 0.21 },
  { symbol: 'AXISBANK', name: 'Axis Bank', exch: 'NSE', base: 1229.50, vol: 0.008, iv: 0.24 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', exch: 'NSE', base: 1932.80, vol: 0.006, iv: 0.22 },
  { symbol: 'LT', name: 'Larsen & Toubro', exch: 'NSE', base: 4012.00, vol: 0.007, iv: 0.23 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', exch: 'NSE', base: 2489.15, vol: 0.005, iv: 0.18 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', exch: 'NSE', base: 7245.80, vol: 0.010, iv: 0.27 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', exch: 'NSE', base: 2564.30, vol: 0.006, iv: 0.21 },
]

export const INDEX_UNIVERSE = [
  { symbol: 'NIFTY50', name: 'Nifty 50 Index', exch: 'NSE', base: 24250.00, vol: 0.004, iv: 0.13, lotSize: 65, strikeStep: 50 },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', exch: 'NSE', base: 55840.60, vol: 0.005, iv: 0.15, lotSize: 30, strikeStep: 100 },
  { symbol: 'SENSEX', name: 'BSE Sensex', exch: 'BSE', base: 79600.00, vol: 0.004, iv: 0.13, lotSize: 20, strikeStep: 100 },
]

export const ALL_INSTRUMENTS = [...STOCK_UNIVERSE, ...INDEX_UNIVERSE]

export function getInstrument(symbol) {
  return ALL_INSTRUMENTS.find(s => s.symbol === symbol)
}

// ---- Search universe: EQUITY + FUT + CE/PE contracts, like the NSE/BSE
// contract picker (e.g. "NIFTY 29SEP26 24000 CE"). Built lazily and cached
// so typing in the search bar doesn't regenerate thousands of rows per key.
let _searchUniverseCache = null

function monthlyExpiries(count) {
  // Last Tuesday of each of the next `count` calendar months — an
  // illustrative monthly-expiry calendar for the simulator (NSE's actual
  // expiry-day rules have changed more than once; check the current NSE
  // circular for real contract dates).
  const out = []
  let d = new Date()
  d.setDate(1)
  for (let m = 0; out.length < count; m++) {
    const monthDate = new Date(d.getFullYear(), d.getMonth() + m + 1, 0) // last day of month
    while (monthDate.getDay() !== 2) monthDate.setDate(monthDate.getDate() - 1) // walk back to Tuesday
    if (monthDate > new Date()) out.push(new Date(monthDate))
  }
  return out
}

function fmtExpiryTag(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mon = date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()
  const yy = String(date.getFullYear()).slice(-2)
  return `${dd}${mon}${yy}`
}

function strikeStepForSearch(instrument) {
  if (instrument.strikeStep) return instrument.strikeStep
  const p = instrument.base
  if (p > 5000) return 100
  if (p > 1500) return 50
  if (p > 500) return 20
  return 10
}

export function buildSearchUniverse() {
  if (_searchUniverseCache) return _searchUniverseCache
  const rows = []
  const expiries = monthlyExpiries(3)

  ALL_INSTRUMENTS.forEach(inst => {
    rows.push({
      kind: 'EQUITY',
      symbol: inst.symbol,
      name: inst.name,
      exch: inst.exch,
      label: inst.symbol,
      sublabel: inst.name,
      underlying: inst.symbol,
    })

    expiries.forEach(exp => {
      const tag = fmtExpiryTag(exp)
      rows.push({
        kind: 'FUT',
        symbol: `${inst.symbol} ${tag} FUT`,
        name: inst.name,
        exch: inst.exch === 'BSE' ? 'BFO' : 'NFO',
        label: `${inst.symbol} ${tag} FUT`,
        sublabel: `${inst.exch === 'BSE' ? 'BFO' : 'NFO'} · FNO`,
        underlying: inst.symbol,
        expiry: exp,
      })

      const step = strikeStepForSearch(inst)
      const atm = Math.round(inst.base / step) * step
      for (let i = -4; i <= 4; i++) {
        const strike = atm + i * step
        if (strike <= 0) continue;
        ['CE', 'PE'].forEach(type => {
          rows.push({
            kind: 'OPTION',
            symbol: `${inst.symbol} ${tag} ${strike} ${type}`,
            name: inst.name,
            exch: inst.exch === 'BSE' ? 'BFO' : 'NFO',
            label: `${inst.symbol} ${tag} ${strike} ${type}`,
            sublabel: `${inst.exch === 'BSE' ? 'BFO' : 'NFO'} · FNO`,
            underlying: inst.symbol,
            expiry: exp,
            strike,
            optionType: type,
          })
        })
      }
    })
  })

  _searchUniverseCache = rows
  return rows
}

export function searchInstruments(query, limit = 30) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const universe = buildSearchUniverse()
  const terms = q.split(/\s+/)
  const matches = universe.filter(row => {
    const hay = `${row.symbol} ${row.name}`.toLowerCase()
    return terms.every(t => hay.includes(t))
  })
  // Rank: exact underlying match first, then equities, then futures, then options
  const kindRank = { EQUITY: 0, FUT: 1, OPTION: 2 }
  matches.sort((a, b) => {
    const aStarts = a.underlying.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.underlying.toLowerCase().startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    if (kindRank[a.kind] !== kindRank[b.kind]) return kindRank[a.kind] - kindRank[b.kind]
    return 0
  })
  return matches.slice(0, limit)
}

const TICK_MS = 1500

function seedHistory(base) {
  const now = Math.floor(Date.now() / 1000 / 60) * 60
  const candles = []
  let price = base * (1 - Math.random() * 0.01)
  for (let i = 179; i >= 0; i--) {
    const t = now - i * 60
    const open = price
    const drift = (Math.random() - 0.5) * base * 0.003
    const close = Math.max(0.05, open + drift)
    const high = Math.max(open, close) + Math.random() * base * 0.001
    const low = Math.min(open, close) - Math.random() * base * 0.001
    candles.push({ time: t, open, high, low, close })
    price = close
  }
  return candles
}

function seedAllPrices() {
  const p = {}
  ALL_INSTRUMENTS.forEach(s => {
    const history = seedHistory(s.base)
    const last = history[history.length - 1]
    p[s.symbol] = {
      ltp: last.close,
      prevClose: s.base * (1 - (Math.random() * 0.02 - 0.01)),
      open: history[0].open,
      high: Math.max(...history.map(c => c.high)),
      low: Math.min(...history.map(c => c.low)),
      history,
    }
  })
  return p
}

const MarketDataContext = createContext(null)

export function MarketDataProvider({ children }) {
  const [prices, setPrices] = useState(seedAllPrices)
  const [flashMap, setFlashMap] = useState({})

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => {
        const next = {}
        const flashes = {}
        for (const key in prev) {
          const cur = prev[key]
          const meta = getInstrument(key)
          const changePct = (Math.random() - 0.5) * meta.vol * 2
          const newLtp = Math.max(0.05, cur.ltp * (1 + changePct))
          const lastCandle = cur.history[cur.history.length - 1]
          const nowBucket = Math.floor(Date.now() / 1000 / 60) * 60
          let newHistory
          if (lastCandle.time === nowBucket) {
            const updated = {
              ...lastCandle,
              high: Math.max(lastCandle.high, newLtp),
              low: Math.min(lastCandle.low, newLtp),
              close: newLtp,
            }
            newHistory = [...cur.history.slice(0, -1), updated]
          } else {
            const newCandle = { time: nowBucket, open: lastCandle.close, high: newLtp, low: newLtp, close: newLtp }
            newHistory = [...cur.history.slice(-239), newCandle]
          }
          next[key] = {
            ...cur,
            ltp: newLtp,
            high: Math.max(cur.high, newLtp),
            low: Math.min(cur.low, newLtp),
            history: newHistory,
          }
          if (newLtp > cur.ltp) flashes[key] = 'up'
          else if (newLtp < cur.ltp) flashes[key] = 'down'
        }
        setFlashMap(flashes)
        return next
      })
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <MarketDataContext.Provider value={{ prices, flashMap }}>
      {children}
    </MarketDataContext.Provider>
  )
}

export function useMarketData() {
  const ctx = useContext(MarketDataContext)
  if (!ctx) throw new Error('useMarketData must be used within MarketDataProvider')
  return ctx
}
