import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../utils/api.js'
import { useWatchBus } from '../hooks/useSocket.js'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Bus marker — blue circle with bus emoji
const busIcon = L.divIcon({
  html: `<div style="background:#1d4ed8;color:#fff;border-radius:50%;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;font-size:18px;
    border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35);">🚌</div>`,
  className: '', iconSize: [38, 38], iconAnchor: [19, 19],
})

// Passenger crowdsource marker — orange
const passengerIcon = L.divIcon({
  html: `<div style="background:#f59e0b;color:#fff;border-radius:50%;width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;font-size:13px;
    border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.3);">👤</div>`,
  className: '', iconSize: [28, 28], iconAnchor: [14, 14],
})

// Numbered stop marker
const stopIcon = (num, status) => {
  const bg = status === 'passed' ? '#9ca3af'
           : status === 'next'   ? '#1d4ed8'
           : '#16a34a'
  return L.divIcon({
    html: `<div style="background:${bg};color:#fff;border-radius:50%;width:22px;height:22px;
      display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${num}</div>`,
    className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  })
}

// Map auto-follow
function MapFocus({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function BusTracking() {
  const { id }    = useParams()
  const navigate  = useNavigate()

  const [bus,        setBus]        = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('eta')
  const [mapCenter,  setMapCenter]  = useState([12.9250, 79.1325])
  const [notifyStop, setNotifyStop] = useState('')
  const [notifySet,  setNotifySet]  = useState(false)
  const [onBus,      setOnBus]      = useState(false)
  const [crowdCount, setCrowdCount] = useState(0)

  // Passenger crowdsource GPS
  const watchRef    = useRef(null)
  const intervalRef = useRef(null)
  const posRef      = useRef(null)

  // ── Load bus on mount ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    api.getBus(id)
      .then(data => {
        setBus(data)
        if (data.live_lat && data.live_lng) {
          setMapCenter([data.live_lat, data.live_lng])
        } else if (data.stops?.length) {
          const mid = data.stops[Math.floor(data.stops.length / 2)]
          setMapCenter([mid.lat, mid.lng])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // ── Live WebSocket updates ───────────────────────────────────────────────
  const onLiveUpdate = useCallback((data) => {
    setBus(prev => {
      if (!prev) return prev
      return {
        ...prev,
        live_lat:       data.lat,
        live_lng:       data.lng,
        live_speed:     data.speed_kmh,
        is_active:      data.is_active,
        source_type:    data.source_type,
        stops:          data.stops?.length ? data.stops : prev.stops,
        next_stop_name: data.next_stop_name,
        next_stop_eta:  data.next_stop_eta,
      }
    })
    if (data.lat && data.lng) setMapCenter([data.lat, data.lng])
  }, [])

  useWatchBus(id, onLiveUpdate)

  // Poll every 10s as REST fallback
  useEffect(() => {
    const t = setInterval(() => {
      api.getBus(id).then(data => {
        setBus(data)
        if (data.live_lat && data.live_lng) setMapCenter([data.live_lat, data.live_lng])
      }).catch(() => {})
    }, 10000)
    return () => clearInterval(t)
  }, [id])

  // ── "I'm on this bus" — passenger crowdsource GPS ────────────────────────
  const startSharingLocation = () => {
    if (!navigator.geolocation) {
      alert('GPS not available on this device')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setOnBus(true)
        setCrowdCount(c => c + 1)

        // Watch position continuously
        watchRef.current = navigator.geolocation.watchPosition(
          pos => {
            posRef.current = {
              lat:   pos.coords.latitude,
              lng:   pos.coords.longitude,
              speed: pos.coords.speed != null && pos.coords.speed > 0
                       ? Math.round(pos.coords.speed * 3.6) : 20,
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        )

        // Send to backend every 5 seconds as crowdsourced location
        intervalRef.current = setInterval(async () => {
          if (!posRef.current) return
          try {
            await api.updatePassengerLocation(
              parseInt(id),
              posRef.current.lat,
              posRef.current.lng,
              posRef.current.speed
            )
          } catch {}
        }, 5000)
      },
      (err) => {
        if (err.code === 1) {
          alert('Location denied. Please allow location in browser settings to help others.')
        } else {
          alert('Could not get your location. Please try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const stopSharingLocation = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setOnBus(false)
    setCrowdCount(c => Math.max(0, c - 1))
  }

  useEffect(() => () => { stopSharingLocation() }, [])

  // ── Notify at stop ───────────────────────────────────────────────────────
  const handleNotify = () => {
    if (!notifyStop.trim()) return
    setNotifySet(true)
    // In production: register push notification for this stop
  }

  // ── Loading / Error states ───────────────────────────────────────────────
  if (loading) return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div className="spinner" />
      <div style={{ fontSize: 14, color: 'var(--text3)' }}>Loading bus info…</div>
    </div>
  )

  if (!bus) return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <div style={{ fontSize: 48 }}>🚫</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Bus not found</div>
      <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  )

  const stops       = bus.stops || []
  const nextStop    = stops.find(s => s.status === 'next')
  const routeCoords = stops.map(s => [s.lat, s.lng])
  const isLive      = bus.is_active
  const schedule    = bus.schedule || []

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>

      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1085ba, #036ea7)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
          {bus.name}
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.2)', color: '#fff',
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        }}>
          {bus.bus_number}
        </div>
      </div>

      {/* ── ROUTE INFO BAR ── */}
      <div style={{
        background: 'var(--bg2)', padding: '8px 14px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              {bus.start_point}
            </span>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>→</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              {bus.end_point}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20,
            background: isLive ? '#dcfce7' : 'var(--bg3)',
            border: `1px solid ${isLive ? '#16a34a' : 'var(--border)'}`,
            fontSize: 13, fontWeight: 600,
            color: isLive ? '#16a34a' : 'var(--text3)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isLive ? '#16a34a' : '#9ca3af',
              display: 'inline-block',
              animation: isLive ? 'pulse 1.5s infinite' : 'none',
            }} />
            {isLive ? 'Live' : 'Schedule only'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{bus.route_name}</div>
      </div>

      {/* ── MAP ── z-index:0 stops Leaflet bleeding over drawer/modals */}
      <div style={{ height: 260, flexShrink: 0, position: 'relative', zIndex: 0 }}>
        <MapContainer
          center={mapCenter} zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <MapFocus center={mapCenter} />

          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <Polyline positions={routeCoords} color="#21678f" weight={3} opacity={0.6} />
          )}

          {/* Numbered stop markers */}
          {stops.map((stop, idx) => (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={stopIcon(idx + 1, stop.status)}
            >
              <Popup>
                <b>{stop.name}</b><br />
                Stop {idx + 1}<br />
                {stop.status === 'passed' && '✓ Passed'}
                {stop.status === 'next' && `⏱ Next — ${stop.eta_minutes} min`}
                {stop.status === 'upcoming' && stop.eta_minutes != null && `${stop.eta_minutes} min away`}
              </Popup>
            </Marker>
          ))}

          {/* Live bus marker */}
          {isLive && bus.live_lat && bus.live_lng && (
            <Marker position={[bus.live_lat, bus.live_lng]} icon={busIcon}>
              <Popup>
                <b>{bus.name}</b><br />
                Speed: {bus.live_speed || 0} km/h<br />
                Source: {bus.source_type}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Speed chip on map */}
        {isLive && bus.live_speed != null && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1000,
            background: 'var(--bg2)', borderRadius: 8,
            padding: '4px 10px', fontSize: 12, fontWeight: 700,
            border: '1px solid var(--border)', color: 'var(--text)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}>
            {bus.live_speed} km/h
          </div>
        )}
      </div>

      {/* ── NOTIFY BAR ── */}
      <div style={{
        background: 'var(--bg2)', padding: '10px 14px',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <input
          value={notifyStop}
          onChange={e => { setNotifyStop(e.target.value); setNotifySet(false) }}
          placeholder="Notify me at a stop…"
          style={{
            flex: 1, padding: '8px 12px', border: '1.5px solid var(--border)',
            borderRadius: 20, fontSize: 13, background: 'var(--bg)',
            color: 'var(--text)', outline: 'none',
          }}
          list="stop-list"
        />
        <datalist id="stop-list">
          {stops.map(s => <option key={s.id} value={s.name} />)}
        </datalist>
        <button
          onClick={handleNotify}
          style={{
            padding: '8px 14px', borderRadius: 20, border: 'none',
            background: notifySet ? '#16a34a' : '#148ac9',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
          {notifySet ? '✓ Set' : 'Set'}
        </button>
      </div>

      {/* ── "I'M ON THIS BUS" BUTTON ── */}
      <div style={{
        padding: '10px 14px', background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {!onBus ? (
          <div>
            <button
              onClick={startSharingLocation}
              style={{
                width: '100%', padding: '11px', borderRadius: 24,
                border: '1.5px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              🚌 I'm on this bus
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: '#fef3c7', border: '1px solid #f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                  Sharing your location
                </div>
              </div>
              <button
                onClick={stopSharingLocation}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: 'none',
                  background: '#ef4444', color: '#fff',
                  fontSize: 16, fontWeight: 600, cursor: 'pointer',
                }}>
                Leave bus
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{
        display: 'flex', background: 'var(--bg2)',
        borderBottom: '2px solid var(--border)', flexShrink: 0,
      }}>
        {[
          { key: 'eta',      label: 'ETA & Stops' },
          { key: 'schedule', label: 'Schedule'     },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, padding: '12px 4px', border: 'none',
              background: 'transparent', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === t.key ? '#101e40' : 'var(--text3)',
              borderBottom: activeTab === t.key ? '2px solid #06143a' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ETA & STOPS TAB ── */}
      {activeTab === 'eta' && (
        <div className="scroll">
          {/* Route summary row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {bus.start_point} → {bus.end_point}
            </div>
            <div style={{ fontSize: 16, color: 'var(--text3)' }}>
              {stops.length} stops
            </div>
          </div>

          {/* No live tracking card */}
          {!isLive && (
            <div style={{ margin: '12px 14px' }}>
              <div style={{
                background: 'var(--bg2)', borderRadius: 12,
                border: '1px solid var(--border)',
                padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <span style={{ fontSize: 28 }}>🕐</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    No live tracking right now
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                    Bus position will appear once a driver starts their trip. Check the Schedule tab for departure times.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live next stop card */}
          {isLive && nextStop && (
            <div style={{
              margin: '12px 14px',
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 12, padding: '12px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600, marginBottom: 2 }}>NEXT STOP</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a8a' }}>{nextStop.name}</div>
                <div style={{ fontSize: 12, color: '#11213b', marginTop: 2 }}>{nextStop.distance_km} km away</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#284baa', lineHeight: 1 }}>
                  {nextStop.eta_minutes}
                </div>
                <div style={{ fontSize: 14, color: '#1d4ed8', fontWeight: 600 }}>min</div>
              </div>
            </div>
          )}

          {/* Stop timeline */}
          <div style={{ padding: '4px 16px 24px' }}>
            {stops.map((stop, idx) => {
              const isPassed   = stop.status === 'passed'
              const isNext     = stop.status === 'next'
              const isUpcoming = stop.status === 'upcoming'
              const isFirst    = idx === 0
              const isLast     = idx === stops.length - 1

              return (
                <div key={stop.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Timeline spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                    {/* Top line */}
                    {idx > 0 && (
                      <div style={{
                        width: 2, height: 16,
                        background: isPassed ? '#9ca3af' : 'var(--border)',
                        marginBottom: 2,
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: isPassed ? 10 : 12,
                      height: isPassed ? 10 : 12,
                      borderRadius: '50%',
                      background: isPassed ? '#9ca3af' : isNext ? '#159db3' : isFirst ? '#16a34a' : isLast ? '#ef4444' : '#e5e7eb',
                      border: isNext ? '2px solid #082d67' : '2px solid transparent',
                      boxShadow: isNext ? '0 0 0 3px #dbeafe' : 'none',
                      flexShrink: 0,
                    }} />
                    {/* Bottom line */}
                    {idx < stops.length - 1 && (
                      <div style={{
                        width: 2, height: 16,
                        background: isPassed ? '#9ca3af' : 'var(--border)',
                        marginTop: 2,
                      }} />
                    )}
                  </div>

                  {/* Stop content */}
                  <div style={{
                    flex: 1, paddingBottom: 8,
                    background: isNext ? '#eff6ff' : 'transparent',
                    borderRadius: isNext ? 8 : 0,
                    padding: isNext ? '6px 10px' : '0 0 8px 0',
                    marginLeft: isNext ? -4 : 0,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                        {/* Badges */}
                        {isFirst && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: '#dcfce7', color: '#166534', fontWeight: 700,
                          }}>START</span>
                        )}
                        {isLast && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: '#fee2e2', color: '#991b1b', fontWeight: 700,
                          }}>END</span>
                        )}
                        {isNext && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: '#dbeafe', color: '#1e40af', fontWeight: 700,
                          }}>NEXT</span>
                        )}
                        {/* Stop name */}
                        <span style={{
                          fontSize: 13,
                          fontWeight: isNext ? 700 : 400,
                          color: isPassed ? '#9ca3af' : isNext ? '#1d4ed8' : 'var(--text)',
                          textDecoration: isPassed ? 'line-through' : 'none',
                        }}>
                          {stop.name}
                        </span>
                      </div>

                      {/* ETA badge */}
                      <div style={{ flexShrink: 0, marginLeft: 6 }}>
                        {isPassed && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>✓ Passed</span>
                        )}
                        {isNext && stop.eta_minutes != null && (
                          <span style={{
                            background: '#dbeafe', color: '#1e40af',
                            padding: '2px 8px', borderRadius: 20,
                            fontSize: 12, fontWeight: 700,
                          }}>
                            {stop.eta_minutes} min
                          </span>
                        )}
                        {isUpcoming && stop.eta_minutes != null && (
                          <span style={{
                            background: '#dcfce7', color: '#166534',
                            padding: '2px 8px', borderRadius: 20,
                            fontSize: 12, fontWeight: 600,
                          }}>
                            {stop.eta_minutes} min
                          </span>
                        )}
                        {(isNext || isUpcoming) && stop.eta_minutes == null && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                        )}
                      </div>
                    </div>

                    {/* Distance below name */}
                    {!isPassed && stop.distance_km != null && (
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        {stop.distance_km} km
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'schedule' && (
        <div className="scroll" style={{ padding: 16 }}>
          {/* Next departure highlight */}
          {bus.next_departure && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: '#dcfce7', border: '1px solid #16a34a',
              marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>NEXT DEPARTURE</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#166534' }}>{bus.next_departure}</div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                  from {bus.start_point}
                </div>
              </div>
              <span style={{ fontSize: 32 }}>🕐</span>
            </div>
          )}

          {/* All departure times */}
          <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 10 }}>
            All departures from <b style={{ color: 'var(--text)' }}>{bus.start_point}</b>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {schedule.map((s, i) => (
              <span key={i} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                textDecoration: s.status === 'past' ? 'line-through' : 'none',
                background: s.status === 'past'   ? 'var(--bg3)'
                          : s.status === 'next'   ? '#dcfce7'
                          : '#dbeafe',
                color:      s.status === 'past'   ? 'var(--text3)'
                          : s.status === 'next'   ? '#166534'
                          : '#1e40af',
                border: s.status === 'next' ? '1.5px solid #16a34a' : '1.5px solid transparent',
              }}>
                {s.time}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}