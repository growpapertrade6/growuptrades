import { createContext, useContext, useEffect, useState } from 'react'

export const STOCK_UNIVERSE = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', exch: 'NSE', base: 2945.60, vol: 0.006, iv: 0.22 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exch: 'NSE', base: 4128.30, vol: 0.005, iv: 0.20 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exch: 'NSE', base: 1687.15, vol: 0.007, iv: 0.21 },
  { symbol: 'INFY', name: 'Infosys', exch: 'NSE', base: 1842.90, vol: 0.006, iv: 0.23 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exch: 'NSE', base: 1264.40, vol: 0.007, iv: 0.22 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exch: 'NSE', base: 1698.75, vol: 0.008, iv: 0.24 },
  { symbol: 'SBIN', name: 'State Bank of India', exch: 'NSE', base: 831.20, vol: 0.009, iv: 0.26 },
  { symbol: 'ITC', name: 'ITC Limited', exch: 'NSE', base: 468.55, vol: 0.005, iv: 0.19 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exch: 'NSE', base: 986.30, vol: 0.012, iv: 0.32 },
  { symbol: 'WIPRO', name: 'Wipro', exch: 'NSE', base: 289.45, vol: 0.008, iv: 0.25 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', exch: 'NSE', base: 2841.90, vol: 0.015, iv: 0.38 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', exch: 'NSE', base: 12480.50, vol: 0.007, iv: 0.23 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', exch: 'NSE', base: 1782.65, vol: 0.006, iv: 0.21 },
  { symbol: 'AXISBANK', name: 'Axis Bank', exch: 'NSE', base: 1189.30, vol: 0.008, iv: 0.24 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', exch: 'NSE', base: 1932.80, vol: 0.006, iv: 0.22 },
  { symbol: 'LT', name: 'Larsen & Toubro', exch: 'NSE', base: 3612.40, vol: 0.007, iv: 0.23 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', exch: 'NSE', base: 2489.15, vol: 0.005, iv: 0.18 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', exch: 'NSE', base: 7245.80, vol: 0.010, iv: 0.27 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', exch: 'NSE', base: 2564.30, vol: 0.006, iv: 0.21 },
]

export const INDEX_UNIVERSE = [
  { symbol: 'NIFTY50', name: 'Nifty 50 Index', exch: 'NSE', base: 24582.30, vol: 0.004, iv: 0.13, lotSize: 65, strikeStep: 50 },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', exch: 'NSE', base: 55840.60, vol: 0.005, iv: 0.15, lotSize: 30, strikeStep: 100 },
  { symbol: 'SENSEX', name: 'BSE Sensex', exch: 'BSE', base: 80730.20, vol: 0.004, iv: 0.13, lotSize: 20, strikeStep: 100 },
]

export const ALL_INSTRUMENTS = [...STOCK_UNIVERSE, ...INDEX_UNIVERSE]

export function getInstrument(symbol) {
  return ALL_INSTRUMENTS.find(s => s.symbol === symbol)
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
