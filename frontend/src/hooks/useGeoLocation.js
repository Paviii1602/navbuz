import { useState, useEffect, useRef, useCallback } from 'react'

// GPS status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'

export function useGeoLocation({ onPosition, enabled = false, interval = 4000 }) {
  const [status,   setStatus]   = useState('idle')
  const [position, setPosition] = useState(null)
  const [error,    setError]    = useState(null)
  const watchRef   = useRef(null)
  const intervalRef = useRef(null)
  const posRef     = useRef(null)
  const cbRef      = useRef(onPosition)

  useEffect(() => { cbRef.current = onPosition }, [onPosition])

  // Check permission status on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') setStatus('granted')
        else if (result.state === 'denied') setStatus('denied')
        result.onchange = () => {
          if (result.state === 'granted') setStatus('granted')
          else if (result.state === 'denied') setStatus('denied')
          else setStatus('idle')
        }
      }).catch(() => {})
    }
  }, [])

  const stopGPS = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      setError('GPS is not available on this device')
      return
    }
    setStatus('requesting')
    setError(null)

    // First: explicit permission request via getCurrentPosition
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('granted')
        const loc = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          // GPS speed is in m/s — convert to km/h, default 20 if null
          speed:    pos.coords.speed != null && pos.coords.speed > 0
                      ? Math.round(pos.coords.speed * 3.6) : 20,
          accuracy: pos.coords.accuracy,
        }
        setPosition(loc)
        posRef.current = loc
        cbRef.current?.(loc)

        // Then start continuous watch
        watchRef.current = navigator.geolocation.watchPosition(
          (p) => {
            const l = {
              lat:      p.coords.latitude,
              lng:      p.coords.longitude,
              speed:    p.coords.speed != null && p.coords.speed > 0
                          ? Math.round(p.coords.speed * 3.6) : 20,
              accuracy: p.coords.accuracy,
            }
            setPosition(l)
            posRef.current = l
            cbRef.current?.(l)
          },
          (err) => {
            if (err.code === 1) { setStatus('denied');  setError('Location access denied. Please allow in browser settings.') }
            else if (err.code === 2) { setStatus('error'); setError('Location unavailable. Check GPS signal.') }
            else { setStatus('error'); setError('GPS timeout. Please try again.') }
          },
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        )
      },
      (err) => {
        if (err.code === 1) {
          setStatus('denied')
          setError('Location access denied. To fix: tap the lock icon in browser → Site Settings → Location → Allow.')
        } else if (err.code === 2) {
          setStatus('error')
          setError('Location unavailable. Check your GPS signal.')
        } else {
          setStatus('error')
          setError('GPS request timed out. Please try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => {
    if (enabled) startGPS()
    else stopGPS()
    return stopGPS
  }, [enabled, startGPS, stopGPS])

  return { status, position, error, startGPS, stopGPS }
}
