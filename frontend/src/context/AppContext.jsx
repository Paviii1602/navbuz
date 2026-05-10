import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('navbus_user')) } catch { return null }
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('navbus_theme') || 'light')
  const [locationGranted, setLocationGranted] = useState(() =>
    localStorage.getItem('navbus_loc_granted') === 'true'
  )
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('navbus_theme', theme)
  }, [theme])

  const login = useCallback((userData) => {
    setUser(userData)
    localStorage.setItem('navbus_user', JSON.stringify(userData))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('navbus_user')
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }, [])

  const grantLocation = useCallback(() => {
    setLocationGranted(true)
    localStorage.setItem('navbus_loc_granted', 'true')
  }, [])

  const showToast = useCallback((msg, type = 'info', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return (
    <AppContext.Provider value={{
      user, login, logout,
      theme, toggleTheme,
      locationGranted, grantLocation,
      showToast, toasts,
    }}>
      {children}
      <ToastContainer toasts={toasts} />
    </AppContext.Provider>
  )
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, width: '90%', maxWidth: 360,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 18px', borderRadius: 12, fontSize: 14, fontWeight: 500,
          background: t.type === 'error' ? '#ef4444' : t.type === 'success' ? '#16a34a' : '#1d4ed8',
          color: '#fff', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.3s ease',
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}