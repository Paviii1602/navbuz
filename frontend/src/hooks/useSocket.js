import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const BASE = import.meta.env.VITE_API_URL || window.location.origin

let _socket = null

function getSocket() {
  if (!_socket) {
    _socket = io(BASE, {
      transports:         ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay:    2000,
      timeout:              10000,
    })
  }
  return _socket
}

// Hook for PASSENGERS — watch a specific bus
export function useWatchBus(busId, onUpdate) {
  const [connected, setConnected] = useState(false)
  const cbRef = useRef(onUpdate)
  useEffect(() => { cbRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!busId) return
    const s = getSocket()

    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onUpdate     = (data) => { if (data.bus_id == busId) cbRef.current?.(data) }

    s.on('connect',    onConnect)
    s.on('disconnect', onDisconnect)
    s.on('bus_update', onUpdate)
    s.emit('watch_bus', { bus_id: busId })
    setConnected(s.connected)

    return () => {
      s.emit('unwatch_bus', { bus_id: busId })
      s.off('connect',    onConnect)
      s.off('disconnect', onDisconnect)
      s.off('bus_update', onUpdate)
    }
  }, [busId])

  return { connected }
}

// Hook for DRIVERS — send GPS location
export function useDriverSocket() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = getSocket()
    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    s.on('connect',    onConnect)
    s.on('disconnect', onDisconnect)
    setConnected(s.connected)
    return () => {
      s.off('connect',    onConnect)
      s.off('disconnect', onDisconnect)
    }
  }, [])

  const sendLocation = useCallback((busId, lat, lng, speed) => {
    const s = getSocket()
    if (s.connected) {
      s.emit('driver_location', { bus_id: busId, lat, lng, speed })
    }
  }, [])

  return { connected, sendLocation }
}
