import { useState, useRef } from 'react'
import { uploadAudio, getTranscribeStatus } from '../utils/api'
import { useMeetingStore } from '../utils/store'
import Card from './Card'

const STAGES = [
  { pct: 0,   label: 'Uploading file...',              icon: '⬆' },
  { pct: 30,  label: 'Transcribing (faster-whisper)…', icon: '🎙' },
  { pct: 55,  label: 'Diarizing speakers…',            icon: '👥' },
  { pct: 70,  label: 'Analyzing sentiment…',           icon: '💬' },
  { pct: 82,  label: 'Generating summary…',            icon: '📝' },
  { pct: 95,  label: 'Saving results…',                icon: '💾' },
  { pct: 100, label: 'Done!',                          icon: '✅' },
]

function getStage(pct) {
  return [...STAGES].reverse().find(s => pct >= s.pct) || STAGES[0]
}

export default function UploadPanel({ meetingId }) {
  const [dragging, setDragging]     = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(0)
  const [error, setError]           = useState(null)
  const [done, setDone]             = useState(false)
  const fileRef                     = useRef()
  const pollRef                     = useRef()
  const { setMeeting }              = useMeetingStore()

  const processFile = async (file) => {
    if (!file) return
    setError(null)
    setDone(false)
    setUploading(true)
    setProgress(0)

    try {
      // Upload
      await uploadAudio(meetingId, file, (pct) => {
        setProgress(Math.min(28, pct * 0.28))
      })
      setProgress(30)

      // Poll backend status
      pollRef.current = setInterval(async () => {
        try {
          const res = await getTranscribeStatus(meetingId)
          const status = res.data.status
          if (status === 'processing') {
            setProgress((p) => Math.min(94, p + 2))
          } else if (status === 'done') {
            clearInterval(pollRef.current)
            setProgress(100)
            setDone(true)
            setUploading(false)
            // Reload meeting data
            const { getMeeting, getSpeakers, getActionItems, getSummary, getAnalytics, getSegments } = await import('../utils/api')
            const [mRes, spkRes, aiRes, segRes] = await Promise.all([
              getMeeting(meetingId),
              getSpeakers(meetingId),
              getActionItems(meetingId),
              getSegments(meetingId),
            ])
            setMeeting(mRes.data)
            const { useMeetingStore: s } = await import('../utils/store')
            const store = s.getState()
            store.setSpeakers(spkRes.data)
            store.setActionItems(aiRes.data)
            store.setSegments(segRes.data)
            try {
              const [sumRes, anRes] = await Promise.all([getSummary(meetingId), getAnalytics(meetingId)])
              store.setSummary(sumRes.data)
              store.setAnalytics(anRes.data)
            } catch (_) {}
          } else if (status === 'error') {
            clearInterval(pollRef.current)
            setError('Processing failed on the server. Check backend logs.')
            setUploading(false)
          }
        } catch (_) {}
      }, 2500)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const onFileChange = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const stage = getStage(progress)

  return (
    <Card title="Upload Recording" icon="⬆">
      {/* Drop zone */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? '#6c63ff' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 12, padding: '32px 24px', textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? 'rgba(108,99,255,0.06)' : 'transparent',
          transition: '0.2s',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
        <div style={{ fontSize: 14, marginBottom: 4 }}>
          <strong style={{ color: '#6c63ff' }}>Click to upload</strong> or drag & drop
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>MP3 · MP4 · WAV · WEBM · M4A · OGG</div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/*"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Progress */}
      {uploading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span>{stage.icon} {stage.label}</span>
            <span style={{ fontFamily: 'DM Mono, monospace', color: '#6c63ff' }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 6, background: '#181c24', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'linear-gradient(90deg, #6c63ff, #00d4aa)',
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>
          {/* Stage steps */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            {STAGES.filter(s => s.pct < 100).map((s) => {
              const active = progress >= s.pct
              return (
                <div key={s.pct} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 6,
                  background: active ? 'rgba(108,99,255,0.15)' : '#181c24',
                  color: active ? '#818cf8' : '#6b7280',
                  border: `1px solid ${active ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  transition: '0.3s',
                }}>
                  {s.icon} {s.label}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Success */}
      {done && (
        <div style={{
          marginTop: 16, padding: '14px 16px',
          background: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 10, fontSize: 13, color: '#34d399',
        }}>
          ✅ Processing complete! Switch to <strong>Summary</strong> or <strong>Speakers</strong> tabs to view results.
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 16, padding: '14px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, fontSize: 13, color: '#f87171',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Tips */}
      <div style={{ marginTop: 20, padding: '14px 16px', background: '#181c24', borderRadius: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Tips for best accuracy
        </div>
        {[
          '🎙 Use a 16kHz+ mono WAV or high-bitrate MP3',
          '🔇 Minimize background noise for better diarization',
          '👥 Ensure speakers don\'t talk over each other',
          '⏱ Files up to 2 hours are supported',
        ].map((tip, i) => (
          <div key={i} style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{tip}</div>
        ))}
      </div>
    </Card>
  )
}
