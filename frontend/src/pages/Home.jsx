import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../utils/api.js'
import ProfileDrawer from '../components/ProfileDrawer.jsx'

export default function Home() {
  const { user, showToast, saveRecentSearch } = useApp()
  const navigate = useNavigate()
  const [allStops,  setAllStops]  = useState([])
  const [fromVal,   setFromVal]   = useState('')
  const [toVal,     setToVal]     = useState('')
  const [fromFocus, setFromFocus] = useState(false)
  const [toFocus,   setToFocus]   = useState(false)
  const [searching, setSearching] = useState(false)
  const [drawer,    setDrawer]    = useState(false)
  const [userCity,  setUserCity]  = useState('Vellore, Tamil Nadu')

  const fromRef = useRef()
  const toRef   = useRef()

  useEffect(() => {
    api.getAllStops().then(setAllStops).catch(() => {})

    // FIX 1 — reverse geocode using proper headers
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const addr  = data.address || {}
          const city  = addr.city || addr.town || addr.village || addr.county || 'Vellore'
          const state = addr.state || 'Tamil Nadu'
          setUserCity(`${city}, ${state}`)
        } catch {}
      }, () => {})
    }
  }, [])

  // Show ALL stops on focus, filter when typing
  const filteredFrom = allStops.filter(s =>
    fromVal.trim().length === 0
      ? true
      : s.name.toLowerCase().includes(fromVal.toLowerCase())
  )
  const filteredTo = allStops.filter(s =>
    toVal.trim().length === 0
      ? true
      : s.name.toLowerCase().includes(toVal.toLowerCase())
  )

  const swap = () => {
    const temp = fromVal
    setFromVal(toVal)
    setToVal(temp)
  }

  const search = async () => {
    if (!fromVal.trim() || !toVal.trim()) {
      showToast('Enter both From and To stops', 'error')
      return
    }
    setSearching(true)
    try {
      const results = await api.searchStops(fromVal, toVal)
      if (!results.length) {
        showToast('No buses found for this route', 'error')
        setSearching(false)
        return
      }
      // Save to recent searches
      if (saveRecentSearch) saveRecentSearch(fromVal, toVal)
      navigate('/search', { state: { results, from: fromVal, to: toVal } })
    } catch {
      showToast('Search failed. Check connection.', 'error')
    } finally {
      setSearching(false)
    }
  }

  // DropItem component
  const DropItem = ({ name, onSelect }) => (
    <div
      onMouseDown={e => { e.preventDefault(); onSelect() }}
      style={{
        padding: '12px 16px', fontSize: 14, cursor: 'pointer',
        borderBottom: '1px solid var(--border)', color: 'var(--text)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg2)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
    >
      <span style={{ color: 'var(--primary)', fontSize: 13 }}>📍</span>
      <span>{name}</span>
    </div>
  )

  const dropdownStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
    background: 'var(--bg2)', border: '1.5px solid var(--primary)',
    borderRadius: 'var(--radius-sm)', maxHeight: 220, overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 4,
  }

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>

      {/* ── HEADER — blue gradient ── */}
      <div style={{
        background: 'linear-gradient(160deg, #18b4d8 0%, #15a8cd 40%, #036ea7 100%)',
        padding: '16px 16px 28px',
        flexShrink: 0,
      }}>
        {/* Top row: logo + profile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 26 }}>🚌</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>NavBus</span>
          </div>
          <button
            onClick={() => setDrawer(true)}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              border: '2px solid rgba(255,255,255,0.5)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
            {user.username[0].toUpperCase()}
          </button>
        </div>

        {/* Location info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          <span style={{ fontSize: 13 }}>📍</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 400 }}>
            {userCity}
          </span>
        </div>

        {/* Search card */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(10px)',
          borderRadius: 16, padding: '16px 14px',
          border: '1px solid rgba(255,255,255,0.25)',
        }}>
          {/* FROM */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>
              FROM
            </div>
            <div style={{ position: 'relative' }}>
              <input ref={fromRef} value={fromVal}
                onChange={e => setFromVal(e.target.value)}
                onFocus={() => setFromFocus(true)}
                onBlur={() => setTimeout(() => setFromFocus(false), 150)}
                placeholder="Select start stop"
                autoComplete="off"
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 10,
                  border: 'none', background: '#fff', color: '#111',
                  fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
              />
              {fromFocus && filteredFrom.length > 0 && (
                <div style={dropdownStyle}>
                  <div style={{ padding: '6px 14px', fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                    {fromVal.trim() ? `${filteredFrom.length} stops found` : `${filteredFrom.length} stops available`}
                  </div>
                  {filteredFrom.map(s => (
                    <DropItem key={s.id} name={s.name} onSelect={() => { setFromVal(s.name); setFromFocus(false) }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Swap */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <button onClick={swap} style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              border: '1.5px solid rgba(255,255,255,0.5)',
              color: '#fff', fontSize: 17, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>⇅</button>
          </div>

          {/* TO */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>
              TO
            </div>
            <div style={{ position: 'relative' }}>
              <input ref={toRef} value={toVal}
                onChange={e => setToVal(e.target.value)}
                onFocus={() => setToFocus(true)}
                onBlur={() => setTimeout(() => setToFocus(false), 150)}
                placeholder="Select destination"
                autoComplete="off"
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 10,
                  border: 'none', background: '#fff', color: '#111',
                  fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
              />
              {toFocus && filteredTo.length > 0 && (
                <div style={dropdownStyle}>
                  <div style={{ padding: '6px 14px', fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                    {toVal.trim() ? `${filteredTo.length} stops found` : `${filteredTo.length} stops available`}
                  </div>
                  {filteredTo.map(s => (
                    <DropItem key={s.id} name={s.name} onSelect={() => { setToVal(s.name); setToFocus(false) }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Find My Bus */}
          <button onClick={search} disabled={searching} style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: searching ? 'rgba(255,255,255,0.5)' : '#fff',
            color: searching ? 'rgba(0,0,0,0.4)' : 'var(--primary)',
            fontSize: 15, fontWeight: 700,
            cursor: searching ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            🔍 {searching ? 'Searching…' : 'Find My Bus'}
          </button>

          {/* Find Buses Near Me — dashed */}
          <button onClick={() => showToast('Finding nearest stop…', 'info')} style={{
            width: '100%', padding: '12px', borderRadius: 10,
            border: '2px dashed rgba(255,255,255,0.6)',
            background: 'transparent', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            📍 Find Buses Near Me
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="scroll">
        <div style={{ padding: '16px' }}>
          {/* You can add quick links or info cards here */}
        </div>
      </div>

      {/* Bottom tabs */}
      <div className="bottom-tabs">
        <button className="tab active" onClick={() => {}} style={{ opacity: 1 }}>
          <span className="tab-icon">🏠</span>Home
        </button>
        <button className="tab" onClick={() => navigate('/schedule')} style={{ cursor: 'pointer' }}>
          <span className="tab-icon">🕐</span>Schedule
        </button>
      </div>

      {drawer && <ProfileDrawer onClose={() => setDrawer(false)} />}
    </div>
  )
}