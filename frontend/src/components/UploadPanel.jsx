import { useState, useRef } from 'react'
import { uploadAudio, startTranscription } from '../utils/api'
import { useMeetingStore } from '../utils/store'
import Card from './Card'

export default function UploadPanel({ meetingId }) {
  const [dragging, setDragging]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState(null)
  
  const fileRef = useRef()

  const {
    setActiveTab, addToast,
    audioUrl, setAudioUrl,
    setAudioTime, setIsAudioPlaying, setRevealUpTo,
  } = useMeetingStore()

  // ── File handling ─────────────────────────────────────────────────────────
  const processFile = async (file) => {
    if (!file) return
    setError(null)
    setUploading(true)
    setProgress(0)
    setAudioTime(0)
    setIsAudioPlaying(false)
    setRevealUpTo(0)  // reset for new audio

    const blobUrl = URL.createObjectURL(file)
    setAudioUrl(blobUrl)

    try {
      await uploadAudio(meetingId, file, (pct) => setProgress(pct))
      setUploading(false)
      addToast('✅ Upload successful! Transcription is starting.', 'success')
      await startTranscription(meetingId)
      setActiveTab('live')
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      setUploading(false)
      setAudioUrl(null)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <Card title="Upload Recording" icon="⬆">

      {/* ── Drop zone ──────────────────────── */}
      {!audioUrl && (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? '#6c63ff' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 12, padding: '28px 24px', textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            background: dragging ? 'rgba(108,99,255,0.06)' : 'transparent',
            transition: '0.2s',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎵</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            <strong style={{ color: '#6c63ff' }}>Click to upload</strong> or drag &amp; drop
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>MP3 · MP4 · WAV · WEBM · M4A</div>
          <input ref={fileRef} type="file" accept="audio/*,video/*"
            onChange={(e) => processFile(e.target.files[0])} style={{ display: 'none' }} />
        </div>
      )}

      {/* ── Uploading progress ───────────────────────────────────────────── */}
      {uploading && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span>⬆ Uploading file...</span>
            <span style={{ fontFamily: 'DM Mono, monospace', color: '#6c63ff' }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 6, background: '#181c24', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'linear-gradient(90deg, #6c63ff, #00d4aa)',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
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

      {/* ── Tips ──────────────────────────────────────────────────────────── */}
      {!uploading && !audioUrl && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#181c24', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Tips for best results
          </div>
          {[
            '🎙 Use clear audio with minimal background noise',
            '👥 Ensure speakers don\'t talk over each other',
            '🔑 Set HF_TOKEN in .env for accurate speaker names',
            '🤖 Pull llama3 for intelligent summaries',
          ].map((tip, i) => (
            <div key={i} style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>{tip}</div>
          ))}
        </div>
      )}

      {audioUrl && !uploading && (
        <div style={{
          marginTop: 16, padding: '14px 16px',
          background: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 10, fontSize: 13, color: '#34d399',
        }}>
          ✅ Upload successful! Please proceed to the <strong>Live</strong> tab to start transcription and follow along.
        </div>
      )}
    </Card>
  )
}