import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts'
import { useMarketData } from '../context/MarketDataContext'

const TF_MINUTES = { '1m': 1, '5m': 5, '15m': 15, '1H': 60 }

function aggregate(oneMinCandles, tfMinutes) {
  if (tfMinutes <= 1) return oneMinCandles
  const bucketSize = tfMinutes * 60
  const buckets = new Map()
  for (const c of oneMinCandles) {
    const bt = Math.floor(c.time / bucketSize) * bucketSize
    if (!buckets.has(bt)) {
      buckets.set(bt, { time: bt, open: c.open, high: c.high, low: c.low, close: c.close })
    } else {
      const b = buckets.get(bt)
      b.high = Math.max(b.high, c.high)
      b.low = Math.min(b.low, c.low)
      b.close = c.close
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time)
}

export default function PriceChart({ symbol, timeframe = '1m', height = 260 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const { prices } = useMarketData()

  // Create chart once per mount.
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8B95A1', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      grid: { vertLines: { color: '#1A222B' }, horzLines: { color: '#1A222B' } },
      timeScale: { borderColor: '#232C36', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#232C36' },
      crosshair: { mode: 0 },
      autoSize: true,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#1C9E6B',
      downColor: '#D9524F',
      borderVisible: false,
      wickUpColor: '#1C9E6B',
      wickDownColor: '#D9524F',
    })
    chartRef.current = chart
    seriesRef.current = series
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Full reload only when symbol or timeframe changes — not on every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const history = prices[symbol]?.history ?? []
    const tfMinutes = TF_MINUTES[timeframe] ?? 1
    const agg = aggregate(history, tfMinutes)
    seriesRef.current?.setData(agg)
  }, [symbol, timeframe])

  // Cheap incremental update on every live tick — folds only the candles
  // belonging to the currently-forming bucket, so this stays fast
  // regardless of how much history has accumulated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const history = prices[symbol]?.history
    if (!history || history.length === 0 || !seriesRef.current) return
    const tfMinutes = TF_MINUTES[timeframe] ?? 1
    const bucketSize = tfMinutes * 60
    const lastRaw = history[history.length - 1]
    const bucketTime = Math.floor(lastRaw.time / bucketSize) * bucketSize
    let open = null, high = -Infinity, low = Infinity, close = null
    for (let i = history.length - 1; i >= 0; i--) {
      const c = history[i]
      if (c.time < bucketTime) break
      if (close === null) close = c.close
      open = c.open
      high = Math.max(high, c.high)
      low = Math.min(low, c.low)
    }
    if (open !== null) {
      seriesRef.current.update({ time: bucketTime, open, high, low, close })
    }
  }, [symbol, timeframe, prices[symbol]?.ltp])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Live candlestick chart for ${symbol}`}
      style={{ width: '100%', height }}
    />
  )
}
