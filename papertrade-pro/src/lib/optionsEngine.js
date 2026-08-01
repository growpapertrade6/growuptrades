// Simulated options pricing using the Black-Scholes model.
// This computes theoretically fair premiums from the simulated spot price —
// it does not reflect real market bid/ask or open interest.

function erf(x) {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

function normCDF(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)))
}

// Illustrative risk-free rate used only for premium simulation.
const RISK_FREE_RATE = 0.065

export function blackScholes(spot, strike, daysToExpiry, iv, type) {
  const T = Math.max(daysToExpiry, 0.25) / 365
  const S = spot
  const K = strike
  const r = RISK_FREE_RATE
  const sigma = Math.max(iv, 0.03)
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  let price
  if (type === 'CE') {
    price = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
  } else {
    price = K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1)
  }
  return Math.max(price, 0.05)
}

// Illustrative weekly (Thursday) expiries for the simulator.
// NSE's actual expiry-day calendar has changed more than once — check the
// current NSE circular before treating these dates as real trading dates.
export function nextExpiries(count = 4) {
  const expiries = []
  let d = new Date()
  d.setHours(15, 30, 0, 0)
  while (expiries.length < count) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
    if (d.getDay() === 4) expiries.push(new Date(d))
  }
  return expiries
}

export function strikeStepFor(instrument) {
  if (instrument.strikeStep) return instrument.strikeStep
  const p = instrument.base
  if (p > 5000) return 100
  if (p > 1500) return 50
  if (p > 500) return 20
  return 10
}

// Approximates a lot size that keeps contract notional near the band NSE
// targets for stock options. Real lot sizes are set and periodically revised
// by NSE/SEBI — treat this as illustrative, not authoritative.
export function lotSizeFor(instrument) {
  if (instrument.lotSize) return instrument.lotSize
  const target = 175000
  const raw = target / instrument.base
  return Math.max(5, Math.round(raw / 5) * 5)
}

export function generateChain(instrument, spot, expiryDate) {
  const step = strikeStepFor(instrument)
  const atm = Math.round(spot / step) * step
  const strikes = []
  for (let i = -6; i <= 6; i++) strikes.push(atm + i * step)
  const daysToExpiry = Math.max(0.5, (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return strikes.map(strike => ({
    strike,
    isATM: strike === atm,
    ce: blackScholes(spot, strike, daysToExpiry, instrument.iv, 'CE'),
    pe: blackScholes(spot, strike, daysToExpiry, instrument.iv, 'PE'),
  }))
}
