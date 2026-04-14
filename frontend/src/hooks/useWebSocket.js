import { useRef, useCallback, useEffect } from 'react'
import { wsLiveUrl } from '../utils/api'
import { useMeetingStore } from '../utils/store'

const CHUNK_MS = 3000  // Send audio every 3 seconds

export function useLiveAudio(meetingId) {
  const wsRef          = useRef(null)
  const recorderRef    = useRef(null)
  const streamRef      = useRef(null)
  const addSegment     = useMeetingStore((s) => s.addSegment)
  const setIsRecording = useMeetingStore((s) => s.setIsRecording)

  const start = useCallback(async () => {
    if (!meetingId) return

    // Get mic access
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
    } catch (err) {
      alert('Microphone access denied: ' + err.message)
      return
    }

    // Open WebSocket
    const ws = new WebSocket(wsLiveUrl(meetingId))
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected to meeting', meetingId)
      setIsRecording(true)

      // Detect best mimeType
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
      const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorderRef.current = recorder

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 512 && ws.readyState === WebSocket.OPEN) {
          const buf = await e.data.arrayBuffer()
          ws.send(buf)
        }
      }

      recorder.start(CHUNK_MS)
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'segment') {
          addSegment(msg)
        }
      } catch (_) {}
    }

    ws.onerror = (e) => console.error('[WS] Error:', e)

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setIsRecording(false)
    }
  }, [meetingId, addSegment, setIsRecording])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    wsRef.current?.close()
    setIsRecording(false)
  }, [setIsRecording])

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop])

  return { start, stop }
}


// ── Dashboard listener (read-only WS) ────────────────────────────────────────
export function useMeetingListener(meetingId) {
  const wsRef      = useRef(null)
  const addSegment = useMeetingStore((s) => s.addSegment)

  useEffect(() => {
    if (!meetingId) return

    const { wsListenUrl } = require('../utils/api')
    const ws = new WebSocket(wsListenUrl(meetingId))
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'segment') addSegment(msg)
      } catch (_) {}
    }

    return () => ws.close()
  }, [meetingId, addSegment])
}
