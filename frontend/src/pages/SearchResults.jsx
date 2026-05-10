import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function SearchResults() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const { showToast } = useApp()
  const results    = state?.results || []
  const fromStop   = state?.from    || ''
  const toStop     = state?.to      || ''

  if (!results.length) {
    return (
      <div className="page" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 64 }}>🚫</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>No buses found</div>
        <button className="btn btn-primary" onClick={() => navigate('/home')}>Go Back</button>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="app-header">
        <button onClick={() => navigate('/home')}
          style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: 'var(--text)' }}>
          ←
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Available Buses</div>
          <div style={{ fontSize: 16, color: '#ffffff' }}>{fromStop} → {toStop}</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div className="scroll" style={{ padding: 16 }}>
        {results.map((result, ri) => (
          <div key={ri} style={{ marginBottom: 20 }}>
            {/* Route label */}
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--primary)',
              padding: '6px 12px', background: 'var(--primary-l)',
              borderRadius: 8, marginBottom: 10,
            }}>
              {result.route_name}
            </div>

            {/* Bus cards */}
            {result.buses.map(bus => (
              <div key={bus.id} className="card"
                onClick={() => navigate(`/bus/${bus.id}`, { state: { routeResult: result } })}
                style={{ padding: 16, marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{bus.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20,
                      background: bus.is_active ? 'var(--success-l)' : 'var(--bg3)',
                      color: bus.is_active ? 'var(--success)' : 'var(--text3)',
                      fontWeight: 600,
                    }}>
                      {bus.is_active ? '🟢 LIVE' : '⚫ Scheduled'}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text3)' }}>{bus.bus_number}</div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 2 }}>{bus.operating_hours}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {bus.next_departure && (
                    <>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Next bus</div>
                      <span className="badge badge-green" style={{ fontSize: 13 }}>{bus.next_departure}</span>
                    </>
                  )}
                  <div style={{ fontSize: 20, color: 'var(--text3)', marginTop: 6 }}>›</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
