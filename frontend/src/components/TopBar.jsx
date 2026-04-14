import { useState, useEffect } from 'react'
import { useMeetingStore } from '../utils/store'
import { endMeeting, exportPDF, deleteMeeting } from '../utils/api'
import { useNavigate } from 'react-router-dom'
import { useLiveAudio } from '../hooks/useWebSocket'
import { audioRef } from './AudioManager'

function fmt(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function TopBar({ meetingId }) {
  const navigate = useNavigate()
  const { meeting, isRecording, duration, setIsRecording, audioUrl, audioTime, isAudioPlaying, setAudioTime, setActiveTab, setRevealUpTo } = useMeetingStore()
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

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return
    try {
      await deleteMeeting(meetingId)
      navigate('/meetings')
    } catch (err) {
      alert('Failed to delete meeting')
    }
  }

  return (
    <div className="h-16 bg-white/[0.02] backdrop-blur-xl border-b border-white/5 flex items-center px-6 gap-6 shrink-0 relative z-20 font-['Inter']">
      <div>
        <div className="text-[15px] font-bold text-white/90">{meeting?.title || 'Loading...'}</div>
        <div className="text-[11px] text-white/30 uppercase tracking-widest font-bold">
          {meeting?.participant_count || 0} speakers · {(meeting?.word_count || 0).toLocaleString()} words
        </div>
      </div>

      {/* Status badge */}
      <StatusBadge status={isRecording ? 'recording' : status} />

      {/* Mini audio player — shown only when audio is loaded */}
      {audioUrl && (
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full py-1.5 pl-2 pr-4 transition-all hover:bg-white/10">
          <button
            onClick={() => {
              const el = audioRef.current
              if (!el) return
              if (isAudioPlaying) {
                const t = el.currentTime
                el.pause()
                setRevealUpTo(t)     // explicit snapshot
                setAudioTime(t)
                setActiveTab('live')
              } else {
                el.play()
              }
            }}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] text-black shadow-lg flex items-center justify-center text-[10px] transition-transform active:scale-90"
          >
            {isAudioPlaying ? '⏸' : '▶'}
          </button>
          <span className="font-mono text-[13px] text-white/70 min-w-[36px]">
            {String(Math.floor(audioTime / 60)).padStart(2,'0')}:{String(Math.floor(audioTime % 60)).padStart(2,'0')}
          </span>
          {isAudioPlaying && (
            <div className="flex items-center gap-[2px] h-3">
              {[1,2,3].map(i => (
                <div key={i} className="w-[2px] bg-[#5ed29c] rounded-full animate-pulse" style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Timer */}
      <div className="font-mono text-[14px] text-[#fbbf24] bg-[#fbbf24]/10 px-3 py-1 rounded-md border border-[#fbbf24]/20">
        {fmt(duration)}
      </div>

      {/* Export */}
      <a
        href={exportPDF(meetingId)}
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 bg-white/5 border border-white/10 hover:border-[#5ed29c]/50 text-white/70 hover:text-white rounded-full text-[12px] font-bold uppercase transition-all flex items-center gap-2"
      >
        <span>⬇</span> EXPORT PDF
      </a>

      {/* Delete Option */}
      <button
        onClick={handleDelete}
        className="px-4 py-2 bg-red-500/5 border border-red-500/10 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 rounded-full text-[12px] font-bold uppercase transition-all"
      >
        🗑 DELETE
      </button>

      {/* Record toggle */}
      <button
        onClick={handleToggleRecord}
        className={`px-6 py-2 rounded-full text-[12px] font-bold uppercase transition-all shadow-lg ${
          isRecording 
            ? 'bg-red-500 text-white shadow-red-500/20 animate-pulse' 
            : 'bg-[#5ed29c] text-black shadow-[#5ed29c]/20 hover:scale-105 active:scale-95'
        }`}
      >
        {isRecording ? '⏹ STOP' : '🎙 RECORD'}
      </button>
    </div>
  )
}

function StatusBadge({ status }) {
  const configs = {
    recording:  { color: '#f87171', border: 'border-red-500/20', bg: 'bg-red-500/10', label: 'LIVE',       pulse: true },
    live:       { color: '#f87171', border: 'border-red-500/20', bg: 'bg-red-500/10', label: 'LIVE',       pulse: true },
    processing: { color: '#fbbf24', border: 'border-amber-500/20', bg: 'bg-amber-500/10',  label: 'PROCESSING', pulse: true },
    done:       { color: '#5ed29c', border: 'border-[#5ed29c]/20', bg: 'bg-[#5ed29c]/10',  label: 'DONE',       pulse: false },
    error:      { color: '#f87171', border: 'border-red-500/20', bg: 'bg-red-500/10', label: 'ERROR',      pulse: false },
  }
  const c = configs[status] || configs.done

  return (
    <div 
      className={`px-3 py-1 rounded-full ${c.bg} ${c.border} border flex items-center gap-2 text-[10px] font-black uppercase tracking-widest`}
      style={{ color: c.color }}
    >
      {c.pulse && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c.color }} />}
      {c.label}
    </div>
  )
}
