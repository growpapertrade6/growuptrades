// NSE/BSE cash & F&O market hours: Mon–Fri, 9:15 AM – 3:30 PM IST.
// Weekends and outside these hours count as closed. (Doesn't account for
// exchange holidays — that would need a holiday calendar.)

export function isMarketOpen() {
  const now = new Date()
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  const ist = new Date(istString)

  const day = ist.getDay() // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false

  const minutesNow = ist.getHours() * 60 + ist.getMinutes()
  const marketOpen = 9 * 60 + 15   // 9:15 AM
  const marketClose = 15 * 60 + 30 // 3:30 PM

  return minutesNow >= marketOpen && minutesNow <= marketClose
}

export function marketClosedReason() {
  return 'Market is closed. NSE/BSE trading hours: Mon–Fri, 9:15 AM – 3:30 PM IST.'
}
