import { useState, useEffect } from 'react'
import { useMeetingStore } from '../utils/store'
import { endMeeting, exportPDF } from '../utils/api'
import { useLiveAudio } from '../hooks/useWebSocket'

function fmt(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function TopBar({ meetingId }) {
  const { meeting, isRecording, duration, setIsRecording } = useMeetingStore()
  const { start, stop } = useLiveAudio(meetingId)

  const handleToggleRecord = async () => {
    if (isRecording) {
      stop()
      try { await endMeeting(meetingId) } catch (_) {}
    } else {
      await start()
    }
  }

  const status = meeting?.status || 'live'
  const isLive = status === 'live'

  return (
    <div style={{
      height: 56, background: '#111318',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 16, flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{meeting?.title || 'Loading...'}</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          {meeting?.participant_count || 0} speakers · {(meeting?.word_count || 0).toLocaleString()} words
        </div>
      </div>

      {/* Status badge */}
      <StatusBadge status={isRecording ? 'recording' : status} />

      <div style={{ flex: 1 }} />

      {/* Timer */}
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#f59e0b' }}>
        {fmt(duration)}
      </div>

      {/* Export */}
      <a
        href={exportPDF(meetingId)}
        target="_blank"
        rel="noreferrer"
        style={{
          padding: '6px 14px', background: '#181c24',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          color: '#e8eaf0', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', textDecoration: 'none', fontFamily: 'Sora, sans-serif',
        }}
      >⬇ Export PDF</a>

      {/* Record toggle */}
      <button
        onClick={handleToggleRecord}
        style={{
          padding: '6px 16px', border: 'none', borderRadius: 8,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'Sora, sans-serif', transition: '0.15s',
          background: isRecording ? 'rgba(239,68,68,0.15)' : '#6c63ff',
          color: isRecording ? '#f87171' : '#fff',
        }}
      >
        {isRecording ? '⏹ Stop' : '🎙 Record'}
      </button>
    </div>
  )
}

function StatusBadge({ status }) {
  const configs = {
    recording:  { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   label: 'LIVE',       pulse: true },
    live:       { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   label: 'LIVE',       pulse: true },
    processing: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  label: 'PROCESSING', pulse: true },
    done:       { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'DONE',       pulse: false },
    error:      { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   label: 'ERROR',      pulse: false },
  }
  const c = configs[status] || configs.done

  return (
    <div style={{ padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
      {c.pulse && <span className="live-dot" style={{ background: c.color }} />}
      {c.label}
    </div>
  )
}
