import { useEffect, useState } from 'react'
import { NEWS_FUNCTION_URL } from '../supabaseClient'
import { timeAgo } from '../lib/format'

export default function News() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(NEWS_FUNCTION_URL)
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        if (!cancelled) {
          setItems(data.items ?? [])
          setStatus('ok')
        }
      } catch (e) {
        if (!cancelled) setStatus('error')
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 14 }}>Market news</div>

      {status === 'loading' && <div className="empty-state">Loading headlines…</div>}

      {status === 'error' && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>News feed unavailable</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Couldn't reach the news function. Make sure you've deployed the <span className="mono">fetch-news</span> Edge
            Function and set <span className="mono">VITE_NEWS_FUNCTION_URL</span> in your <span className="mono">.env</span> file
            — see the README's deployment steps.
          </div>
        </div>
      )}

      {status === 'ok' && items.length === 0 && (
        <div className="empty-state">No headlines returned right now — try again shortly.</div>
      )}

      {status === 'ok' && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it, i) => (
            <a key={i} href={it.link} target="_blank" rel="noopener noreferrer" className="card" style={{ display: 'block' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{it.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 10 }}>
                {it.source && <span>{it.source}</span>}
                {it.pubDate && <span>{timeAgo(it.pubDate)}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
