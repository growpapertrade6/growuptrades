import { createContext, useContext, useState, useRef, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const showToast = useCallback((title, sub, isErr = false) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ title, sub, isErr, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={`toast ${toast.isErr ? 'err' : ''}`} key={toast.key}>
          <div className="toast-title">{toast.title}</div>
          {toast.sub && <div className="toast-sub">{toast.sub}</div>}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
