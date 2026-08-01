export function fmtINR(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const neg = n < 0
  const abs = Math.abs(n)
  const parts = abs.toFixed(decimals).split('.')
  const intPart = parts[0]
  let lastThree = intPart.substring(intPart.length - 3)
  const otherNumbers = intPart.substring(0, intPart.length - 3)
  if (otherNumbers !== '') lastThree = ',' + lastThree
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree
  return (neg ? '-' : '') + '₹' + formatted + (decimals > 0 ? '.' + parts[1] : '')
}

export function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtPct(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%'
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}
