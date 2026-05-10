import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const http = axios.create({ baseURL: BASE, timeout: 15000 })

http.interceptors.response.use(
  r => r,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed'
    err.message = msg
    return Promise.reject(err)
  }
)

export const api = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  // Try both old and new route patterns
  login: (d) =>
    http.post('/api/auth/login', d)
      .catch(() => http.post('/api/login', d))
      .then(r => r.data),

  register: (d) =>
    http.post('/api/auth/register', d)
      .catch(() => http.post('/api/register', d))
      .then(r => r.data),

  // ── Routes & Stops ────────────────────────────────────────────────────────
  getRoutes:   ()         => http.get('/api/routes').then(r => r.data),
  getRoute:    (id)       => http.get(`/api/routes/${id}`).then(r => r.data),
  getAllStops:  ()         => http.get('/api/stops/all').then(r => r.data),
  searchStops: (from, to) => http.get('/api/stops/search', { params: { from, to } }).then(r => r.data),

  // ── Buses ─────────────────────────────────────────────────────────────────
  getBuses: ()   => http.get('/api/buses').then(r => r.data),
  getBus:   (id) => http.get(`/api/buses/${id}`).then(r => r.data),

  // ── Driver trip ───────────────────────────────────────────────────────────
  startTrip: (driver_id, bus_id, route_id) =>
    http.post('/api/driver/start-trip', { driver_id, bus_id, route_id })
      .catch(() => http.post('/api/start-trip', { driver_id, bus_id, route_id }))
      .then(r => r.data),

  updateDriverLocation: (trip_id, lat, lng, speed) =>
    http.post('/api/driver/update-location', { trip_id, lat, lng, speed })
      .catch(() => http.post('/api/location/update', { trip_id, lat, lng, speed }))
      .then(r => r.data),

  endTrip: (trip_id) =>
    http.post('/api/driver/end-trip', { trip_id })
      .catch(() => http.post('/api/end-trip', { trip_id }))
      .then(r => r.data),

  // ── Passenger crowdsource ─────────────────────────────────────────────────
  updatePassengerLocation: (bus_id, lat, lng, speed) =>
    http.post(`/api/buses/${bus_id}/location`, {
      lat, lng, speed, source_type: 'crowdsourced',
    }).catch(() =>
      http.post('/api/location/update', {
        bus_id, latitude: lat, longitude: lng, speed, source: 'passenger',
      })
    ).then(r => r.data),

  // ── Health ────────────────────────────────────────────────────────────────
  health: () =>
    http.get('/api/health')
      .catch(() => http.get('/health'))
      .then(r => r.data),
}