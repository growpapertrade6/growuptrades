import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchInstruments } from '../context/MarketDataContext'

function fmtExpiryShort(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '').toUpperCase()
}

const KIND_TAG = { EQUITY: 'EQ', FUT: 'FUT', OPTION: 'FNO' }

export default function InstrumentSearch({ variant = 'desktop', onNavigate }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const results = query.trim() ? searchInstruments(query, 40) : []

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => { setActiveIdx(0) }, [query])

  function selectRow(row) {
    if (!row) return
    setQuery('')
    setOpen(false)
    if (row.kind === 'EQUITY') {
      navigate(`/?symbol=${encodeURIComponent(row.underlying)}`)
    } else if (row.kind === 'FUT') {
      navigate(`/options?underlying=${encodeURIComponent(row.underlying)}`)
    } else {
      const params = new URLSearchParams({
        underlying: row.underlying,
        strike: String(row.strike),
        type: row.optionType,
      })
      navigate(`/options?${params.toString()}`)
    }
    inputRef.current?.blur()
    onNavigate?.()
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); selectRow(results[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  return (
    <div className={`inst-search inst-search-${variant}`} ref={containerRef}>
      <div className="inst-search-box">
        <span className="inst-search-icon">⌕</span>
        <input
          ref={inputRef}
          placeholder="Search stock, future or option (e.g. NIFTY, RELIANCE)"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button className="inst-search-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }}>×</button>
        )}
      </div>

      {open && query.trim() && (
        <div className="inst-search-results">
          {results.length === 0 ? (
            <div className="inst-search-empty">No matching stocks, futures or options for "{query}"</div>
          ) : (
            results.map((row, i) => (
              <div
                key={row.symbol + i}
                className={`inst-search-row ${i === activeIdx ? 'active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => selectRow(row)}
              >
                <div className="inst-search-row-main">
                  <span className="inst-search-symbol">{row.label}</span>
                  {row.kind === 'OPTION' && (
                    <span className={`inst-search-opt-tag ${row.optionType === 'CE' ? 'ce' : 'pe'}`}>{row.optionType}</span>
                  )}
                </div>
                <div className="inst-search-row-sub">
                  <span className="exch-badge">{KIND_TAG[row.kind]}</span>
                  <span>{row.exch}</span>
                  {row.expiry && <span>· {fmtExpiryShort(row.expiry)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
