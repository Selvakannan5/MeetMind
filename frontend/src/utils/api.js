import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''
const WS_BASE = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host

export const api = axios.create({ baseURL: BASE })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, password) => {
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)
  return api.post('/api/auth/login', formData)
}
export const register = (email, password, name) => api.post('/api/auth/register', { email, password, name })
export const googleLogin = (accessToken) => api.post('/api/auth/google', { access_token: accessToken })
export const getMe = () => api.get('/api/auth/me')
export const updateMe = (data) => api.patch('/api/auth/me', data)

// ── Meetings ──────────────────────────────────────────────────────────────────
export const createMeeting   = (title) => api.post('/api/meetings/', { title })
export const listMeetings    = ()      => api.get('/api/meetings/')
export const getMeeting      = (id)    => api.get(`/api/meetings/${id}`)
export const endMeeting      = (id)    => api.post(`/api/meetings/${id}/end`)
export const deleteMeeting   = (id)    => api.delete(`/api/meetings/${id}`)
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
export const startTranscription  = (id) => api.post(`/api/transcribe/process/${id}`)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAnalytics    = (id)    => api.get(`/api/analytics/${id}`)
export const getGlobalAnalytics = () => api.get('/api/analytics/global/stats')
export const getSummary      = (id)    => api.get(`/api/analytics/${id}/summary`)
export const getSegments     = (id)    => api.get(`/api/analytics/${id}/segments`)

// ── Export ────────────────────────────────────────────────────────────────────
export const exportPDF  = (id) => `${BASE}/api/export/${id}/pdf?token=${localStorage.getItem('token') || ''}`
export const exportJSON = (id) => api.get(`/api/export/${id}/json`)

// ── WebSocket helpers ─────────────────────────────────────────────────────────
export const wsLiveUrl   = (id) => `${WS_BASE}/ws/realtime/${id}?token=${localStorage.getItem('token') || ''}`
export const wsListenUrl = (id) => `${WS_BASE}/ws/${id}/listen?token=${localStorage.getItem('token') || ''}`
