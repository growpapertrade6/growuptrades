import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signUp, signIn } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName)
        if (error) setError(error.message)
        else setInfo('Account created. Check your inbox to confirm your email, then sign in.')
      } else {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div className="brand-mark">PT</div>
          <div>
            <div className="brand-name">PaperTrade</div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              NSE / BSE virtual terminal
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, ...(mode === 'signin' ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
            onClick={() => { setMode('signin'); setError(''); setInfo('') }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, ...(mode === 'signup' ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
            onClick={() => { setMode('signup'); setError(''); setInfo('') }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <div>
              <label className="field-label">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}
          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '8px 10px', borderRadius: 4 }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', padding: '8px 10px', borderRadius: 4 }}>
              {info}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.6 }}>
          Starts you with ₹10,00,000 in virtual cash. All prices are simulated — no real money or real market data.
        </p>
      </div>
    </div>
  )
}
