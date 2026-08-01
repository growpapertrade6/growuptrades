import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const SETUP_TAGS = ['Breakout', 'Pullback', 'Reversal', 'Trend follow', 'News-based', 'Other']
const EMOTION_TAGS = ['Confident', 'Anxious', 'FOMO', 'Impatient', 'Disciplined', 'Neutral']

export default function Journal() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [symbol, setSymbol] = useState('')
  const [notes, setNotes] = useState('')
  const [setupTag, setSetupTag] = useState('')
  const [emotionTag, setEmotionTag] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) loadEntries() }, [user])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase.from('journal_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }

  async function saveEntry(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('journal_entries').insert([{
        user_id: user.id,
        title: title.trim(),
        symbol: symbol.trim() || null,
        notes: notes.trim() || null,
        setup_tag: setupTag || null,
        emotion_tag: emotionTag || null,
      }]).select().single()
      if (!error) {
        setEntries(prev => [data, ...prev])
        showToast('Journal entry saved', title)
        setTitle(''); setSymbol(''); setNotes(''); setSetupTag(''); setEmotionTag(''); setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id) {
    await supabase.from('journal_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(en => en.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Trade journal</div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New entry'}</button>
      </div>

      {showForm && (
        <form onSubmit={saveEntry} className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label className="field-label">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. RELIANCE breakout long" required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Symbol (optional)</label>
              <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="RELIANCE" />
            </div>
          </div>

          <div>
            <label className="field-label">What happened / lesson learned</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Entry reason, what went right or wrong, what you'd do differently..." />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <label className="field-label">Setup</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SETUP_TAGS.map(t => (
                  <button
                    type="button" key={t} className="btn"
                    style={{ fontSize: 10.5, padding: '5px 10px', ...(setupTag === t ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
                    onClick={() => setSetupTag(t === setupTag ? '' : t)}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Mindset</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOTION_TAGS.map(t => (
                  <button
                    type="button" key={t} className="btn"
                    style={{ fontSize: 10.5, padding: '5px 10px', ...(emotionTag === t ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
                    onClick={() => setEmotionTag(t === emotionTag ? '' : t)}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', padding: '9px 20px' }}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Loading journal…</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          No journal entries yet. Log a trade to start building your track record.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(entry => (
            <div key={entry.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{entry.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
                    {entry.symbol && <span className="mono">{entry.symbol} · </span>}
                    {new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => deleteEntry(entry.id)} style={{ color: 'var(--text-faint)', fontSize: 15, padding: '2px 6px' }}>×</button>
              </div>
              {entry.notes && <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>{entry.notes}</p>}
              {(entry.setup_tag || entry.emotion_tag) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {entry.setup_tag && <span className="exch-badge">{entry.setup_tag}</span>}
                  {entry.emotion_tag && <span className="exch-badge">{entry.emotion_tag}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
