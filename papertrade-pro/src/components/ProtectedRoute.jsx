import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-faint)' }}>
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <Navbar />
      <div className="page-content">{children}</div>
    </div>
  )
}
