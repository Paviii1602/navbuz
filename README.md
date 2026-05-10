# 🚌 NAVBUS — Vellore Real-Time Bus Tracker v3.0

Complete working app with:
- ✅ Real-time GPS tracking (driver → passengers)
- ✅ Proper GPS permission handling with clear error messages
- ✅ Stop timeline: passed ✓ / next → / upcoming
- ✅ Accurate ETA with road factor (×1.3)
- ✅ WebSocket live updates + REST fallback
- ✅ 4 routes, 40+ stops, 32 buses pre-loaded
- ✅ Real-time schedule with live clock (past times strikethrough)
- ✅ Dark/light theme
- ✅ PWA installable on mobile

---

## 📁 Project Structure

```
navbus_final/
├── backend/
│   ├── app.py           ← Flask server (all API + WebSocket)
│   ├── seed_data.py     ← Routes, stops, buses data
│   ├── requirements.txt
│   └── Procfile         ← For Render deployment
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Splash.jsx
    │   │   ├── Auth.jsx
    │   │   ├── LocationPermission.jsx
    │   │   ├── Home.jsx           ← Search with dropdown stops + swap
    │   │   ├── SearchResults.jsx
    │   │   ├── BusTracking.jsx    ← Map + stops ETA + schedule
    │   │   └── DriverDashboard.jsx ← GPS + trip + stop timeline
    │   ├── components/
    │   │   ├── ProfileDrawer.jsx
    │   │   └── BusScheduleTab.jsx ← Live clock + real-time strikethrough
    │   ├── hooks/
    │   │   ├── useSocket.js       ← WebSocket for passenger + driver
    │   │   └── useGeoLocation.js  ← GPS with full permission handling
    │   ├── context/
    │   │   └── AppContext.jsx     ← Global state + toast notifications
    │   └── utils/
    │       └── api.js             ← All API calls
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Step 1 — Run Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (Mac/Linux)
source venv/bin/activate

# Install packages
pip install -r requirements.txt

# Start server (database auto-created + seeded on first run)
python app.py
```

✅ Backend running at: http://localhost:5000
✅ API health check: http://localhost:5000/api/health
✅ Demo accounts created: passenger/pass123 and driver/driver123

---

## 🎨 Step 2 — Run Frontend

```bash
cd frontend

# Copy env file
copy .env.example .env        # Windows
cp .env.example .env          # Mac/Linux

# Install packages
npm install

# Start dev server
npm run dev
```

✅ Frontend running at: http://localhost:5173

---

## 📱 Step 3 — Test the App

### As Passenger:
1. Open http://localhost:5173
2. Login: passenger / pass123
3. Allow location
4. Search: "Bagayam" → "Katpadi"
5. Tap a bus → see map + stops

### As Driver:
1. Open http://localhost:5173 in incognito
2. Login: driver / driver123
3. Select Route → Select Bus → Start Trip
4. Allow GPS when browser asks
5. Watch the bus appear on passenger map live!

### GPS Not Working?
- Make sure you're on HTTPS (after deploying) or localhost
- Click the 🔒 lock icon → Site Settings → Location → Allow
- On Android Chrome: Settings → Site Settings → Location → Allow

---

## 🌐 Step 4 — Deploy Online (Free)

### Backend → Render.com
1. Push code to GitHub
2. New Web Service on render.com
3. Root directory: `backend`
4. Build: `pip install -r requirements.txt`
5. Start: `gunicorn --worker-class eventlet -w 1 app:app`
6. Get URL: `https://navbus-backend.onrender.com`

### Frontend → Vercel.com
1. New Project on vercel.com
2. Root directory: `frontend`
3. Add env variable: `VITE_API_URL=https://navbus-backend.onrender.com`
4. Deploy
5. Get URL: `https://navbus.vercel.app`

---

## 🔑 Demo Accounts
| Username   | Password   | Role      |
|------------|------------|-----------|
| passenger  | pass123    | Passenger |
| driver     | driver123  | Driver    |

---

## 🔧 API Endpoints

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | /api/auth/register                | Register new user        |
| POST   | /api/auth/login                   | Login                    |
| GET    | /api/routes                       | All routes               |
| GET    | /api/stops/all                    | All unique stops         |
| GET    | /api/stops/search?from=X&to=Y     | Find buses between stops |
| GET    | /api/buses                        | All buses                |
| GET    | /api/buses/:id                    | Bus details + ETA        |
| POST   | /api/driver/start-trip            | Start driving trip       |
| POST   | /api/driver/update-location       | Send GPS ping (REST)     |
| POST   | /api/driver/end-trip              | End trip                 |
| GET    | /api/health                       | Health check             |

## WebSocket Events
| Event           | Direction        | Description                |
|-----------------|------------------|----------------------------|
| watch_bus       | Client → Server  | Subscribe to bus updates   |
| unwatch_bus     | Client → Server  | Unsubscribe                |
| bus_update      | Server → Client  | Live location + ETA push   |
| driver_location | Client → Server  | Driver sends GPS           |
