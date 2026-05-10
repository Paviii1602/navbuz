import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext.jsx'
import Splash             from './pages/Splash.jsx'
import { Login, Register } from './pages/Auth.jsx'
import LocationPermission from './pages/LocationPermission.jsx'
import Home               from './pages/Home.jsx'
import SearchResults      from './pages/SearchResults.jsx'
import BusTracking        from './pages/BusTracking.jsx'
import DriverDashboard    from './pages/DriverDashboard.jsx'
import BusScheduleTab from './components/BusScheduleTab.jsx'

function Guard({ children, role }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useApp()
  const home = user ? (user.role === 'driver' ? '/driver' : '/home') : '/login'

  return (
    <Routes>
      <Route path="/"                  element={<Splash />} />
      <Route path="/login"             element={user ? <Navigate to={home} /> : <Login />} />
      <Route path="/register"          element={user ? <Navigate to={home} /> : <Register />} />
      <Route path="/location-permission" element={<Guard><LocationPermission /></Guard>} />
      <Route path="/location"          element={<Guard><LocationPermission /></Guard>} />
      <Route path="/home"              element={<Guard role="passenger"><Home /></Guard>} />
      <Route path="/schedule"          element={<Guard role="passenger"><BusScheduleTab /></Guard>} />
      <Route path="/search"            element={<Guard role="passenger"><SearchResults /></Guard>} />
      <Route path="/bus/:id"           element={<Guard role="passenger"><BusTracking /></Guard>} />
      <Route path="/driver"            element={<Guard role="driver"><DriverDashboard /></Guard>} />
      <Route path="*"                  element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}