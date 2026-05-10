import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../utils/api.js'
import { useDriverSocket } from '../hooks/useSocket.js'
import { useGeoLocation } from '../hooks/useGeoLocation.js'
import ProfileDrawer from '../components/ProfileDrawer.jsx'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function MapFollow({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

export default function DriverDashboard() {
  const { user, showToast } = useApp()
  const navigate = useNavigate()

  const [routes,     setRoutes]     = useState([])
  const [buses,      setBuses]      = useState([])
  const [selRoute,   setSelRoute]   = useState('')
  const [selBus,     setSelBus]     = useState('')
  const [tripActive, setTripActive] = useState(false)
  const [tripId,     setTripId]     = useState(null)
  const [busData,    setBusData]    = useState(null)
  const [activeTab,  setActiveTab]  = useState('info')
  const [drawer,     setDrawer]     = useState(false)
  const [pingCount,  setPingCount]  = useState(0)

  // GPS enabled only when trip is active
  const [gpsEnabled, setGpsEnabled] = useState(false)

  // WebSocket for driver
  const { connected, sendLocation } = useDriverSocket()

  // GPS hook — handles all permission logic
  const onPosition = useCallback((loc) => {
    if (!tripId || !selBus) return
    // Send via WebSocket (instant)
    sendLocation(selBus, loc.lat, loc.lng, loc.speed)
    // Send via REST as backup
    api.updateDriverLocation(tripId, loc.lat, loc.lng, loc.speed).catch(() => {})
    setPingCount(p => p + 1)
  }, [tripId, selBus, sendLocation])

  const { status: gpsStatus, position, error: gpsError, startGPS } = useGeoLocation({
    onPosition,
    enabled: gpsEnabled,
  })

  // Load routes on mount
  useEffect(() => {
    api.getRoutes().then(setRoutes).catch(() => showToast('Failed to load routes', 'error'))
  }, [])

  // Load buses when route changes
  useEffect(() => {
    if (!selRoute) return
    api.getBuses()
      .then(all => setBuses(all.filter(b => String(b.route_id) === String(selRoute))))
      .catch(() => {})
  }, [selRoute])

  // Poll bus data while trip is active (for stop timeline)
  useEffect(() => {
    if (!tripActive || !selBus) return
    const t = setInterval(() => {
      api.getBus(selBus).then(setBusData).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [tripActive, selBus])

  const handleStart = async () => {
    if (!selRoute || !selBus) { showToast('Select a route and bus first', 'error'); return }
    if (!navigator.geolocation) { showToast('GPS not available on this device', 'error'); return }

    // Check GPS permission before starting trip
    if (gpsStatus === 'denied') {
      showToast('Location is blocked. Allow it in browser settings.', 'error')
      return
    }

    try {
      const trip = await api.startTrip(user.id, parseInt(selBus), parseInt(selRoute))
      const bd   = await api.getBus(selBus)
      setTripId(trip.trip_id)
      setBusData(bd)
      setTripActive(true)
      setGpsEnabled(true)   // triggers GPS hook
      setPingCount(0)
      showToast('🟢 Trip started — GPS is active!', 'success')
    } catch (e) {
      showToast('Failed to start trip: ' + (e.response?.data?.error || e.message), 'error')
    }
  }

  const handleEnd = async () => {
    if (!tripId) return
    try {
      await api.endTrip(tripId)
      setGpsEnabled(false)
      setTripActive(false)
      setTripId(null)
      setBusData(null)
      setPingCount(0)
      setSelBus('')
      setSelRoute('')
      showToast('Trip ended. Thank you! 🙏', 'success')
    } catch {
      showToast('Failed to end trip', 'error')
    }
  }

  const stops      = busData?.stops || []
  const nextStop   = stops.find(s => s.status === 'next')
  const nextDep    = busData?.schedule?.find(s => s.status === 'next')?.time
  const mapCenter  = position ? [position.lat, position.lng] : [12.9250, 79.1325]

  return (
    <>
      <div className="page">
        {/* Header */}
        <div className="app-header" style ={{color: 'var(--primary2)' }} >
          <div>
            <div className="header-logo">
              <span className="header-logo-icon">🚌</span>
              <h1>DRIVER</h1>
            </div>
            <div style={{ fontSize: 12, color: connected ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--warning)' }} />
              {connected ? 'Live connected' : 'Reconnecting…'}
            </div>
          </div>
          <button className="profile-btn" onClick={() => setDrawer(true)}>
            {user.username[0].toUpperCase()}
          </button>
        </div>

        <div className="scroll">
          {/* GPS STATUS BANNER — shows when permission is denied or error */}
          {gpsStatus === 'denied' && (
            <div className="gps-banner denied" style={{ margin: '12px 16px' }}>
              <b>📵 Location access Blocked</b>
              Open phone Settings → Apps → NavBus → Permissions → Location → Allow <br />
              Then refresh the page and try again.
            </div>
          )}
          {gpsStatus === 'unavailable' && (
            <div className="gps-banner denied" style={{ margin: '12px 16px' }}>
              GPS is not available on this device or browser.
            </div>
          )}
          {gpsStatus === 'error' && gpsError && (
            <div className="gps-banner warning" style={{ margin: '12px 16px' }}>
              ⚠️ {gpsError}
            </div>
          )}

          {/* ── PRE-TRIP: Route + Bus selector ── */}
          {!tripActive && (
            <div style={{ padding: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
                  Start Your Trip
                </div>

                {/* Step 1: Route */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 16 }}>
                    SELECT ROUTE
                  </div>
                  <select className="input" value={selRoute}
                    onChange={e => { setSelRoute(e.target.value); setSelBus('') }}
                    style={{ appearance: 'none', cursor: 'pointer' }}>
                    <option value="">Choose a route…</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.route_name}</option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Bus */}
                {selRoute && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>
                      SELECT BUS
                    </div>
                    <select className="input" value={selBus}
                      onChange={e => setSelBus(e.target.value)}
                      style={{ appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Choose your bus…</option>
                      {buses.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.bus_number})</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {buses.length} bus{buses.length !== 1 ? 'es' : ''} on this route
                    </div>
                  </div>
                )}

                <button className="btn btn-success"
                  onClick={handleStart}
                  disabled={!selRoute || !selBus || gpsStatus === 'denied' || gpsStatus === 'unavailable'}>
                  🟢 Start Trip
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVE TRIP ── */}
          {tripActive && (
            <>
              {/* Trip status bar */}
              <div className="trip-bar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span style={{
                      background: 'rgba(21,168,205,0.1', color: '#0e7c88',
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                    }}>
                      {busData?.bus_number}
                    </span>
                    <div style={{ fontSize: 14, color: 'rgba(24, 22, 22, 0.75)', marginTop: 4 }}>
                      {busData?.route_name}
                    </div>
                  </div>
                  <button className="btn btn-danger"
                    style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
                    onClick={handleEnd}>
                    ⏹ End Trip
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0}}>
                  <div className="trip-stat">
                    <div className="val">{position?.speed ?? 0}</div>
                    <div className="lbl">km/h</div>
                  </div>
                  <div className="trip-stat">
                    <div className="val" style={{ fontSize: 12 }}>{nextStop?.name ?? '—'}</div>
                    <div className="lbl">Next Stop</div>
                  </div>
                  <div className="trip-stat">
                    <div className="val" style={{ fontSize: 13 }}>{nextDep ?? '—'}</div>
                    <div className="lbl">Next Dep.</div>
                  </div>
                </div>
              </div>

              {/* Live map — z-index:0 wrapper stops map bleeding over drawer/modals */}
              <div style={{ position: 'relative', zIndex: 0, flexShrink: 0 }}>
                <MapContainer center={mapCenter} zoom={16} style={{ height: 240 }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapFollow center={position ? [position.lat, position.lng] : null} />
                  {position && (
                    <Marker position={[position.lat, position.lng]}>
                      <Popup>You are here<br />Speed: {position.speed} km/h</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>

              {/* Inner tabs */}
              <div style={{ display: 'flex', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                {['info', 'stops', 'schedule'].map(t => (
                  <button key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      flex: 1, padding: '10px 4px', border: 'none', background: 'transparent',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                      color: activeTab === t ? 'var(--primary)' : 'var(--text3)',
                      borderBottom: activeTab === t ? '2px solid var(--primary)' : '2px solid transparent',
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Info tab */}
              {activeTab === 'info' && busData && (
                <div style={{ padding: 16 }}>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {[
                      ['Bus Name',   busData.name],
                      ['Bus Number', busData.bus_number],
                      ['Route',      busData.route_name],
                      ['Hours',      busData.operating_hours],
                      ['Source',     '🟢 Driver Live'],
                    ].map(([k, v]) => (
                      <div key={k} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 14,
                      }}>
                        <span style={{ color: 'var(--text3)' }}>{k}</span>
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stops tab — full timeline with passed/next/upcoming */}
              {activeTab === 'stops' && (
                <div className="timeline" style={{ paddingBottom: 24 }}>
                  {stops.map((stop, idx) => {
                    const isPassed   = stop.status === 'passed'
                    const isNext     = stop.status === 'next'
                    const isUpcoming = stop.status === 'upcoming'
                    const isFirst    = idx === 0
                    const isLast     = idx === stops.length - 1

                    let dotClass = 'upcoming'
                    if (isPassed)    dotClass = 'passed'
                    else if (isNext) dotClass = 'next'
                    else if (isFirst) dotClass = 'start'
                    else if (isLast)  dotClass = 'end'

                    return (
                      <div key={stop.id} className="tl-row">
                        <div className="tl-spine">
                          {idx > 0 && <div className={`tl-line ${isPassed ? 'passed' : ''}`} />}
                          <div className={`tl-dot ${dotClass}`} />
                          {idx < stops.length - 1 && <div className={`tl-line ${isPassed ? 'passed' : ''}`} />}
                        </div>
                        <div className="tl-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {isFirst && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--success-l)', color: 'var(--success)', fontWeight: 700 }}>START</span>}
                              {isLast  && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--danger-l)',  color: 'var(--danger)',  fontWeight: 700 }}>END</span>}
                              {isNext  && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--primary-l)', color: 'var(--primary)', fontWeight: 700 }}>NEXT</span>}
                              <span className={`stop-name ${isPassed ? 'passed' : isNext ? 'next' : ''}`}>
                                {stop.name}
                              </span>
                            </div>
                            <div>
                              {isPassed && <span style={{ fontSize: 11, color: 'var(--text3)' }}>✓ Passed</span>}
                              {isNext && stop.eta_minutes != null && (
                                <span className="badge badge-blue">{stop.eta_minutes} min</span>
                              )}
                              {isUpcoming && stop.eta_minutes != null && (
                                <span className="badge badge-green">{stop.eta_minutes} min</span>
                              )}
                            </div>
                          </div>
                          {stop.distance_km != null && !isPassed && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                              {stop.distance_km} km
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Schedule tab */}
              {activeTab === 'schedule' && busData && (
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>
                    Departures from <b style={{ color: 'var(--text)' }}>{busData.start_point}</b>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(busData.schedule || []).map((s, i) => (
                      <span key={i} className={`sched-chip ${s.status}`}>{s.time}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {drawer && <ProfileDrawer onClose={() => setDrawer(false)} />}
      </div>
  </>
  );
}