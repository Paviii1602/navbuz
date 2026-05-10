import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function ProfileDrawer({ onClose }) {
  const { user, logout, theme, toggleTheme } = useApp()
  const navigate = useNavigate()

  // Load recent searches from localStorage
  const [recentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('navbus_recent') || '[]')
    } catch { return [] }
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const clearRecent = () => {
    localStorage.removeItem('navbus_recent')
    window.location.reload()
  }

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 4px',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 2000,
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '72%', maxWidth: 400, minWidth: 280,
        background: theme === 'dark'? '#111827' : '#fff',
        zIndex: 2001,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        transform: 'translateX(0)',
        transition: 'transform 0.3s ease',
        overflow: 'hidden',
        borderTopLeftRadius: '22px',
        borderBottomLeftRadius: '22px'
      }}>

        {/* ── Profile header ── */}
        <div style={{ padding: '26px 20px 20px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 800, margin: '0 auto 12px',
          }}>
            {user.username[0].toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#111', marginBottom: 6 }}>
            {user.username}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20,
            background: user.role === 'driver' ? '#fef3c7' : '#e0f7fa',
            color: user.role === 'driver' ? '#92400e' : '#006064',
            fontSize: 18, fontWeight: 600,
          }}>
            {user.role === 'driver' ? '🚌' : '🚌'} {user.role === 'driver' ? 'Driver' : 'Passenger'}
          </span>
        </div>

        {/* ── Recent Searches ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', flex: 'none' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5 }}>
              RECENT SEARCHES
            </div>
            {recentSearches.length > 0 && (
              <button onClick={clearRecent}
                style={{ fontSize: 14, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>

          {recentSearches.length === 0 ? (
            <div style={{ fontSize: 16, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
              No recent searches
            </div>
          ) : (
            recentSearches.slice(0, 5).map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: i < recentSearches.length - 1 ? '1px solid #f5f5f5' : 'none',
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: 14, color: '#9ca3af' }}>🔍</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{s}</span>
              </div>
            ))
          )}
        </div>

        {/* ── Settings ── */}
        <div style={{ padding: '10px 20px', flex: 1 }}>
          {/* Light/Dark mode toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0', borderBottom: '1px solid #f0f0f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{theme === 'dark' ? '🌙' : '🌤️'}</span>
              <span style={{ fontSize: 16, color: '#374151', fontWeight: 500 }}>
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            {/* Toggle switch */}
            <div onClick={toggleTheme}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: theme === 'dark' ? 'var(--primary)' : '#e5e7eb',
                cursor: 'pointer', position: 'relative',
                transition: 'background 0.3s',
                flexShrink: 0,
              }}>
              <div style={{
                position: 'absolute', top: 2,
                left: theme === 'dark' ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          {/* Share App */}
          <div onClick={() => {
              if (navigator.share) navigator.share({ title: 'NAVBUS', text: 'Track Vellore buses live!', url: window.location.origin })
              else alert('Share this link: ' + window.location.origin)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 20 }}>📤</span>
            <span style={{ fontSize: 16, color: '#374151', fontWeight: 500 }}>Share App</span>
          </div>

          {/* Rate Us */}
          <div onClick={() => alert('Thank you for using NAVBUS! ⭐')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ fontSize: 16, color: '#374151', fontWeight: 500 }}>Rate Us</span>
          </div>

          {/* About */}
          <div onClick={() => alert('NAVBUS v3.0\nReal-time bus tracking for Vellore\nBuilt with Flask + React')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 0', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 20 }}>ℹ️</span>
            <span style={{ fontSize: 16, color: '#374151', fontWeight: 500 }}>About NAVBUS</span>
          </div>
        </div>

        {/* ── Logout ── */}
        <div style={{ padding: '16px 20px 28px' }}>
          <button onClick={handleLogout}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12, border: 'none',
              background: '#ef4444', color: '#fff',
              fontSize: 18, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            🚪 Log Out
          </button>
        </div>
      </div>
    </>
  )
}