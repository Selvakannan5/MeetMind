import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''
const WS_BASE = BASE.replace(/^http/, 'ws')

export const api = axios.create({ baseURL: BASE })

// ── Meetings ──────────────────────────────────────────────────────────────────
export const createMeeting   = (title) => api.post('/api/meetings/', { title })
export const listMeetings    = ()      => api.get('/api/meetings/')
export const getMeeting      = (id)    => api.get(`/api/meetings/${id}`)
export const endMeeting      = (id)    => api.post(`/api/meetings/${id}/end`)
export const getSpeakers     = (id)    => api.get(`/api/meetings/${id}/speakers`)
export const updateSpeaker   = (mid, sid, data) => api.patch(`/api/meetings/${mid}/speakers/${sid}`, data)
export const getActionItems  = (id)    => api.get(`/api/meetings/${id}/action-items`)
export const updateActionItem = (mid, iid, data) => api.patch(`/api/meetings/${mid}/action-items/${iid}`, data)

// ── Transcription ─────────────────────────────────────────────────────────────
export const uploadAudio     = (id, file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/transcribe/upload/${id}`, form, {
    onUploadProgress: (e) => onProgress?.(Math.round(e.loaded / e.total * 100)),
  })
}
export const getTranscribeStatus = (id) => api.get(`/api/transcribe/status/${id}`)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAnalytics    = (id)    => api.get(`/api/analytics/${id}`)
export const getSummary      = (id)    => api.get(`/api/analytics/${id}/summary`)
export const getSegments     = (id)    => api.get(`/api/analytics/${id}/segments`)

// ── Export ────────────────────────────────────────────────────────────────────
export const exportPDF  = (id) => `${BASE}/api/export/${id}/pdf`
export const exportJSON = (id) => api.get(`/api/export/${id}/json`)

// ── WebSocket helpers ─────────────────────────────────────────────────────────
export const wsLiveUrl   = (id) => `ws://localhost:3000/ws/${id}`
export const wsListenUrl = (id) => `ws://localhost:3000/ws/${id}/listen`
