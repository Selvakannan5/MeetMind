import { useEffect, useRef, useCallback } from 'react'
import { useMeetingStore } from '../utils/store'
import {
  getMeeting, getSpeakers, getActionItems,
  getSummary, getAnalytics, getSegments,
} from '../utils/api'

export function useMeetingData(meetingId) {
  const {
    setMeeting, setSpeakers, setActionItems,
    setSummary, setAnalytics, setSegments,
    addSegment, tickDuration, setProcessingProgress,
  } = useMeetingStore()

  const timerRef      = useRef(null)
  const wsRef         = useRef(null)
  const pollRef       = useRef(null)
  const reconnectRef  = useRef(null)
  const mountedRef    = useRef(true)

  const loadAll = useCallback(async () => {
    if (!meetingId || !mountedRef.current) return
    try {
      const [mRes, spkRes, aiRes, segRes] = await Promise.all([
        getMeeting(meetingId),
        getSpeakers(meetingId),
        getActionItems(meetingId),
        getSegments(meetingId),
      ])
      if (!mountedRef.current) return
      setMeeting(mRes.data)
      setSpeakers(spkRes.data)
      setActionItems(aiRes.data)
      setSegments(segRes.data)
      try {
        const [sumRes, anRes] = await Promise.all([
          getSummary(meetingId),
          getAnalytics(meetingId),
        ])
        if (mountedRef.current) {
          setSummary(sumRes.data)
          setAnalytics(anRes.data)
        }
      } catch (_) {}
    } catch (err) {
      console.error('Failed to load meeting:', err)
    }
  }, [meetingId])

  const connectWS = useCallback(() => {
    if (!meetingId || !mountedRef.current) return

    // Close existing connection cleanly
    if (wsRef.current) {
      wsRef.current._intentionalClose = true
      wsRef.current.close()
      wsRef.current = null
    }

    // Build WS URL — get token from localStorage if auth enabled
    const token = localStorage.getItem('token')
    const host  = window.location.host
    const wsUrl = token
      ? `ws://${host}/ws/${meetingId}/listen?token=${token}`
      : `ws://${host}/ws/${meetingId}/listen`

    console.log('[WS] Connecting to', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    ws._intentionalClose = false

    ws.onopen = () => {
      console.log('[WS] Connected — listening for live segments')
      // Clear any pending reconnect
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
    }

    ws.onmessage = async (e) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(e.data)

        if (msg.type === 'ping') return  // keepalive, ignore

        if (msg.type === 'segment') {
          addSegment(msg)
          if (msg.progress !== undefined) {
            setProcessingProgress(msg.progress)
          }
        }

        if (msg.type === 'status') {
          // Reload meeting status
          try {
            const res = await getMeeting(meetingId)
            if (mountedRef.current) setMeeting(res.data)
          } catch (_) {}
        }

        if (msg.type === 'done') {
          console.log('[WS] Processing done — reloading all data')
          await loadAll()
          // Stop polling
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        }

        if (msg.type === 'error') {
          console.error('[WS] Server error:', msg.message)
        }
      } catch (_) {}
    }

    ws.onclose = (e) => {
      console.log('[WS] Closed — code:', e.code)
      if (ws._intentionalClose || !mountedRef.current) return

      // Reconnect after 3 seconds (not immediately — prevents spam)
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) {
          console.log('[WS] Reconnecting...')
          connectWS()
        }
      }, 3000)
    }

    ws.onerror = (e) => {
      console.warn('[WS] Error — will reconnect:', e)
      ws.close()
    }
  }, [meetingId, addSegment, loadAll, setMeeting])

  useEffect(() => {
    if (!meetingId) return
    mountedRef.current = true

    // Initial data load
    loadAll()

    // Connect WebSocket listener
    connectWS()

    // Polling fallback every 5s (stops when done)
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) return
      try {
        const res = await getMeeting(meetingId)
        if (!mountedRef.current) return
        setMeeting(res.data)
        if (res.data.status === 'done') {
          await loadAll()
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch (_) {}
    }, 5000)

    // Duration tick
    timerRef.current = setInterval(tickDuration, 1000)

    return () => {
      mountedRef.current = false
      clearInterval(pollRef.current)
      clearInterval(timerRef.current)
      clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current._intentionalClose = true
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [meetingId])
}