import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MarketDataProvider } from './context/MarketDataContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OptionsChain from './pages/OptionsChain'
import ChartView from './pages/ChartView'
import News from './pages/News'
import Journal from './pages/Journal'
import Profile from './pages/Profile'

// HashRouter is used deliberately — it needs no server-side rewrite rules,
// which makes the build drop-in compatible with static hosts like GitHub
// Pages without any extra routing configuration.
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MarketDataProvider>
          <PortfolioProvider>
            <HashRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/options" element={<ProtectedRoute><OptionsChain /></ProtectedRoute>} />
                <Route path="/charts" element={<ProtectedRoute><ChartView /></ProtectedRoute>} />
                <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
                <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              </Routes>
            </HashRouter>
          </PortfolioProvider>
        </MarketDataProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
