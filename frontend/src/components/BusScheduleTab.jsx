import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SCHEDULES = [
  { name:'T A',           route:'Bagayam → Katpadi',        times:['05:00','06:30','08:00','09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:02'] },
  { name:'T B',           route:'Bagayam → Katpadi',        times:['05:05','06:35','08:05','09:35','11:05','12:35','14:05','15:35','17:05','18:35','20:09'] },
  { name:'T C',           route:'Bagayam → Katpadi',        times:['05:10','06:40','08:10','09:40','11:10','12:40','14:10','15:40','17:10','18:40','20:16'] },
  { name:'T D',           route:'Bagayam → Katpadi',        times:['05:15','06:45','08:15','09:45','11:15','12:45','14:15','15:45','17:15','18:45','20:23'] },
  { name:'T E',           route:'Bagayam → Katpadi',        times:['05:20','06:50','08:20','09:50','11:20','12:50','14:20','15:50','17:20','18:50','20:30'] },
  { name:'AAA',           route:'Bagayam → Katpadi',        times:['05:23','06:53','08:23','09:53','11:23','12:53','14:23','15:53','17:23','18:53','20:33'] },
  { name:'T F',           route:'Bagayam → Katpadi',        times:['05:25','07:03','08:37','10:22','11:53','13:42','15:22','16:54','18:24','21:24'] },
  { name:'SABS/SKBS',     route:'Bagayam → Katpadi',        times:['05:30','07:00','08:30','10:00','11:30','13:00','14:30','16:00','17:30','19:00','20:30'] },
  { name:'SKBS/SABS',     route:'Bagayam → Katpadi',          times:['05:35','07:05','08:35','10:05','11:35','13:05','14:35','16:05','17:35','19:05','20:35'] },
  { name:'T G',           route:'Bagayam → Katpadi',        times:['05:40','09:47','11:23','14:41','18:57','20:27'] },
  { name:'SKS/VSM',       route:'Bagayam → Katpadi',        times:['05:45','07:15','08:45','10:15','11:45','13:15','14:45','16:15','17:45','19:15','20:45'] },
  { name:'SLSMT/LKM',     route:'Bagayam → Katpadi',        times:['05:50','07:20','08:50','10:20','11:50','13:20','14:50','16:20','17:50','19:20','20:50'] },
  { name:'LKM/SLSMT',     route:'Katpadi → Bagayam',        times:['05:55','07:25','08:55','10:25','11:55','13:25','14:55','16:25','17:55','19:25','20:55'] },
  { name:'VGT/Dhanapathy',route:'Bagayam → Katpadi',        times:['06:00','07:30','09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'] },
  { name:'Dhanapathy/VGT',route:'Katpadi → Bagayam',        times:['06:05','07:35','09:05','10:35','12:05','13:35','15:05','16:35','18:05','19:35','21:05'] },
  { name:'Sri/Devi',      route:'Bagayam → Katpadi',        times:['06:10','07:40','09:10','10:40','12:10','13:40','15:10','16:40','18:10','19:40','21:10'] },
  { name:'Devi/Sri',      route:'Katpadi → Bagayam',        times:['06:15','07:45','09:15','10:45','12:15','13:45','15:15','16:45','18:15','19:45','21:15'] },
  { name:'TKT/SKMS',      route:'Bagayam → Katpadi',        times:['06:20','07:50','09:20','10:50','12:20','13:50','15:20','16:50','18:20','19:50','21:20'] },
  { name:'SKMS/TKT',      route:'Katpadi → Bagayam',        times:['06:25','07:55','09:25','10:55','12:25','13:55','15:25','16:55','18:25','19:55','21:25'] },
  { name:'T N',           route:'Bagayam → Katpadi',        times:['10:35','13:49','15:19','16:49','19:48'] },
  { name:'Balaganesar',   route:'Bagayam → Katpadi',        times:['05:23','06:53','08:23','09:53','11:23','12:53','14:23','15:53','17:23','18:53','20:33'] },
  { name:'T EX1',         route:'Bagayam → Katpadi',        times:['05:40','06:53','09:28','10:51','12:01','13:52','15:16','16:47','18:01','19:47'] },
  { name:'T H',           route:'Bagayam → Katpadi',        times:['05:38','07:19','10:38','14:28','19:38','21:18'] },
  { name:'Srinivasa',     route:'Bagayam → Katpadi',        times:['05:58','07:53','09:28','11:13','12:58','14:43','16:28','18:18','19:58','21:42'] },
  { name:'T O',           route:'Bagayam → Katpadi',        times:['05:53','13:03','14:38','16:08','17:48','19:22','21:12'] },
  { name:'T I',           route:'Bagayam → Katpadi',        times:['06:18','07:49','10:02','11:47','13:17','14:47','16:17','17:46','19:17','21:08'] },
  { name:'T M',           route:'Bagayam → Katpadi',        times:['08:23','09:53','11:22','14:22','15:52','17:22','18:52','20:22'] },
  { name:'T 2GA',         route:'Bagayam → Katpadi',        times:['08:42','13:17','17:47','19:47','21:52'] },
  { name:'VSM/SKS',       route:'Katpadi → Bagayam',        times:['05:40','07:10','08:40','10:10','11:40','13:10','14:40','16:10','17:40','19:10','20:40'] },
  { name:'T E/DR',        route:'Bagayam → Katpadi',        times:['05:18','06:48','08:18','09:48','11:18','12:48','14:18','15:48','17:18','18:48','20:27'] },
  { name:'DR/T E',        route:'Katpadi → Bagayam',        times:['05:21','06:51','08:21','09:51','11:21','12:51','14:21','15:51','17:21','18:51','20:31'] },
]

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function nowMin() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function getNext(times, nm) {
  for (const t of times) {
    if (toMin(t) > nm) return { time: t, tomorrow: false }
  }
  return { time: times[0], tomorrow: true }
}

export default function BusScheduleTab() {
  const navigate = useNavigate()
  const [filter,  setFilter]  = useState('')
  const [nowM,    setNowM]    = useState(nowMin())
  const [clock,   setClock]   = useState('')

  // Live clock — updates every second
  useEffect(() => {
    const tick = () => {
      setNowM(nowMin())
      setClock(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const filtered = SCHEDULES.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.route.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #18b4d8 0%, #15a8cd 40%, #036ea7 100%)',
        padding: '16px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700,
          }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Bus Schedule</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.15)', padding: '5px 10px', borderRadius: 8,
        }}>
          <div className="live-dot" style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4ade80', animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            {clock}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="scroll" style={{ flex: 1 }}>
        <div style={{ padding: '16px' }}>
          <input className="input" placeholder="🔍 Search bus or route…"
            value={filter} onChange={e => setFilter(e.target.value)}
            style={{ marginBottom: 14, fontSize: 13 }} />

          {filtered.map((bus, i) => {
            const { time: nextTime, tomorrow } = getNext(bus.times, nowM)
            const minsUntil = toMin(nextTime) - nowM

            return (
              <div key={i} className="card" style={{ padding: 14, marginBottom: 10 }}>
                {/* Bus header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{bus.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{bus.route}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>
                      {tomorrow ? 'Tomorrow' : 'Next bus'}
                    </div>
                    <span className={`badge ${tomorrow ? 'badge-orange' : 'badge-green'}`} style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      background: tomorrow ? 'var(--warning-l)' : 'var(--success-l)',
                      color: tomorrow ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {nextTime}
                    </span>
                    {!tomorrow && minsUntil <= 60 && minsUntil > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>
                        in {minsUntil} min
                      </div>
                    )}
                    {!tomorrow && minsUntil <= 5 && minsUntil > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>
                        🔴 Arriving soon!
                      </div>
                    )}
                  </div>
                </div>

                {/* Time chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {bus.times.map((t, j) => {
                    const tMin    = toMin(t)
                    const diff    = tMin - nowM
                    const isPast  = diff < 0
                    const isNext  = t === nextTime && !tomorrow
                    const isSoon  = !isPast && diff <= 5

                    let bg, color, border, fontWeight, textDeco
                    if (isPast) {
                      bg = 'var(--bg3)'; color = 'var(--text3)'
                      border = '1.5px solid transparent'; fontWeight = 400; textDeco = 'line-through'
                    } else if (isSoon) {
                      bg = 'var(--danger-l)'; color = 'var(--danger)'
                      border = '1.5px solid var(--danger)'; fontWeight = 700; textDeco = 'none'
                    } else if (isNext) {
                      bg = 'var(--success-l)'; color = 'var(--success)'
                      border = '1.5px solid var(--success)'; fontWeight = 700; textDeco = 'none'
                    } else {
                      bg = 'var(--primary-l)'; color = 'var(--primary)'
                      border = '1.5px solid transparent'; fontWeight = 500; textDeco = 'none'
                    }

                    return (
                      <span key={j} style={{
                        padding: '4px 9px', borderRadius: 6, fontSize: 11,
                        background: bg, color, border, fontWeight, textDecoration: textDeco,
                      }}>
                        {t}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom tabs */}
      <div className="bottom-tabs">
        <button className="tab" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
          <span className="tab-icon">🏠</span>Home
        </button>
        <button className="tab active" onClick={() => {}} style={{ opacity: 1 }}>
          <span className="tab-icon">🕐</span>Schedule
        </button>
      </div>
    </div>
  )
}