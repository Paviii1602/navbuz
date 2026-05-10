import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function LocationPermission() {
  const { user, grantLocation } = useApp()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | granted | denied

  const request = () => {
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        localStorage.setItem('navbus_loc', JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }))
        grantLocation()
        setStatus('granted')
        setTimeout(() => navigate(user?.role === 'driver' ? '/driver' : '/home'), 800)
      },
      () => {
        setStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const skip = () => {
    navigate(user?.role === 'driver' ? '/driver' : '/home')
  }

  return (
    <div className="page" style={{
      alignItems: 'center', justifyContent: 'center',
      gap: 24, padding: 32, textAlign: 'center',
    }}>
        <div style={{ fontSize: 72 }}>📍</div>
        <div >
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Location Access</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7 }}>
            NAVBUS uses your location to show nearby buses and calculate accurate arrival times.
          </div>
        </div>

      {status === 'granted' && (
        <div className="gps-banner granted">✅ Location granted! Redirecting…</div>
      )}
      {status === 'denied' && (
        <div className="gps-banner denied">
          Location denied. You can still use the app but some features may be limited.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
        <button className="btn btn-primary"
          onClick={request}
          disabled={status === 'loading' || status === 'granted'}>
          {status === 'loading' ? 'Getting location…' : '📍 Allow Location'}
        </button>
        <button className="btn btn-secondary" onClick={skip} style={{ fontSize: 13 }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}