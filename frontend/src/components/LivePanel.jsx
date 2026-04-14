import { useState, useEffect, useRef } from 'react'
import { useMeetingStore } from '../utils/store'
import { startTranscription } from '../utils/api'
import { audioRef } from './AudioManager'
import Card from './Card'

const SPEAKER_COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#3b82f6','#a78bfa']
const SPEAKER_BG = [
  'rgba(129,140,248,0.12)', 'rgba(52,211,153,0.12)', 'rgba(251,146,60,0.12)',
  'rgba(244,114,182,0.12)', 'rgba(59,130,246,0.12)', 'rgba(167,139,250,0.12)',
]

const SENTIMENT_STYLES = {
  positive:    { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', label: 'Positive' },
  negative:    { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', label: 'Negative' },
  neutral:     { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: 'Neutral'  },
  questioning: { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24', label: 'Question' },
}

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function initials(label) {
  if (!label) return '??'
  return label.replace('SPEAKER_', 'S').slice(0, 2).toUpperCase()
}

function speakerIndex(label) {
  if (!label) return 0
  const n = parseInt(label.replace(/\D/g, ''), 10)
  return isNaN(n) ? 0 : n % SPEAKER_COLORS.length
}

// Small styled button helper
function Btn({ onClick, children, color = '#5ed29c', danger = false, disabled = false, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-4 py-1.5 rounded-lg text-[12px] font-bold uppercase transition-all flex items-center gap-2 ${
        danger 
          ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20' 
          : 'bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-[#5ed29c]/50 hover:bg-white/10'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
    >
      {children}
    </button>
  )
}

function StatsGrid() {
  const { segments, meeting, processingProgress } = useMeetingStore()
  const total = segments.length
  const pos = segments.filter(s => s.sentiment === 'positive').length
  const sentPct = total > 0 ? Math.round(pos / total * 100) : 0
  const words = segments.reduce((acc, s) => acc + (s.text || '').split(' ').length, 0)

  const stats = [
    { label: 'Duration',     value: meeting?.duration_seconds ? fmt(meeting.duration_seconds) : '—', color: '#fbbf24' },
  ]
  
  if (meeting?.status === 'processing' || meeting?.status === 'uploaded') {
    stats.push({ label: 'Processing', value: `${processingProgress || 0}%`, color: '#6c63ff', sub: 'transcript' })
  }

  stats.push(
    { label: 'Words spoken', value: words.toLocaleString(), color: '#818cf8', sub: 'total' },
    { label: 'Segments',     value: total, color: '#5ed29c', sub: 'transcribed' }
  )

  if (meeting?.status !== 'processing' && meeting?.status !== 'uploaded') {
    stats.push({ label: 'Sentiment',    value: `${sentPct}%`, color: '#5ed29c', sub: 'positive' })
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-row gap-3 mb-6 font-['Inter']">
      {stats.map((s) => (
        <div key={s.label} className="liquid-glass-card flex-1 p-5 min-w-[140px]">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">{s.label}</div>
          <div className="text-[24px] font-black tracking-tighter" style={{ color: s.color }}>{s.value}</div>
          {s.sub && <div className="text-[10px] text-white/20 uppercase tracking-widest mt-1.5">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export default function LivePanel() {
  const { segments, speakers, audioUrl, audioTime, setAudioTime, isAudioPlaying, setIsAudioPlaying, revealUpTo, setRevealUpTo, meeting, addToast, isRecording, setIsRecording } = useMeetingStore()
  const bottomRef = useRef(null)

  const [audioDuration, setAudioDuration] = useState(0)
  const [starting, setStarting] = useState(false)
  const [liveRecordingTime, setLiveRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const streamWsRef = useRef(null)
  const liveIntervalRef = useRef(null)

  // Poll audioDuration from AudioManager element until metadata is available
  useEffect(() => {
    if (!audioUrl) return
    const iv = setInterval(() => {
      if (audioRef.current?.duration && !isNaN(audioRef.current.duration)) {
        setAudioDuration(audioRef.current.duration)
        clearInterval(iv)
      }
    }, 200)
    return () => clearInterval(iv)
  }, [audioUrl])

  // Playback handlers
  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (isAudioPlaying) {
      const t = el.currentTime
      el.pause()
      setRevealUpTo(t)
      setAudioTime(t)
    } else {
      el.play()
    }
  }

  const handleSeek = (e) => {
    const t = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setAudioTime(t)
  }

  const isProcessing = meeting?.status === 'processing' || meeting?.status === 'uploaded'
  const hasAudio = !!audioUrl || !!meeting?.audio_path
  const audioStarted = audioTime > 0 || isAudioPlaying

  // ── Recording Handlers ─────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const token = localStorage.getItem('token')
      const host = window.location.host
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${host}/ws/realtime/${meeting.id}${token ? '?token='+token : ''}`
      
      const ws = new WebSocket(wsUrl)
      streamWsRef.current = ws

      ws.onopen = () => {
        setIsRecording(true)
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        mediaRecorderRef.current = mr

        mr.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }
        
        mr.start(1000) // send chunks every 1 second
        setLiveRecordingTime(0)
        liveIntervalRef.current = setInterval(() => setLiveRecordingTime(t => t + 1), 1000)
        addToast('Live recording started', 'success')
      }

      ws.onerror = () => {
        addToast('Failed to connect to live stream', 'error')
        stopRecording()
      }
    } catch (err) {
      addToast('Microphone access denied or error: ' + err.message, 'error')
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRecorderRef.current = null
    }
    if (streamWsRef.current) {
      streamWsRef.current.close()
      streamWsRef.current = null
    }
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current)
      liveIntervalRef.current = null
    }
    addToast('Recording stopped. Finalizing transcript...', 'success')
  }

  const cancelRecording = () => {
    setIsRecording(false)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRecorderRef.current = null
    }
    if (streamWsRef.current) {
      streamWsRef.current.send('CANCEL')
      streamWsRef.current.close()
      streamWsRef.current = null
    }
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current)
      liveIntervalRef.current = null
    }
    useMeetingStore.getState().setSegments([])
    addToast('Recording cancelled. You can start over.', 'info')
  }

  const safeSegments = segments || []
  let visibleSegments
  if (!hasAudio) {
    // No audio this session → show everything (completed meeting review)
    visibleSegments = safeSegments
  } else if (isProcessing) {
    // Show nothing, let the empty state handle the minimal spinner
    visibleSegments = []
  } else if (!audioStarted && revealUpTo === 0) {
    // Audio loaded, transcription done, but user hasn't pressed play yet
    visibleSegments = []
  } else {
    // Audio is actively playing or has been seeked → sync to timeline
    const timeLimit = Math.max(audioTime, revealUpTo)
    visibleSegments = safeSegments.filter(seg => (seg.start_time ?? 0) <= timeLimit)
  }

  useEffect(() => {
    if (visibleSegments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [visibleSegments.length])

  const nameMap = {}
  if (speakers && Array.isArray(speakers)) {
    speakers.forEach((s) => { nameMap[s.label] = s.name || s.label })
  }

  return (
    <>
      <StatsGrid />

      {/* Live Record UI */}
      {!hasAudio && meeting?.status === 'live' && !isRecording && (
        <div style={{ textAlign: 'center', margin: '40px 0', padding: 40, background: '#111318', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎙️</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#e8eaf0' }}>Start Live Recording</h3>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24, maxWidth: 300, margin: '0 auto 24px' }}>
            Capture meeting audio directly from your microphone and transcribe in true real-time.
          </p>
          <button
            onClick={startRecording}
            style={{
              padding: '12px 24px', background: '#e11d48', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(225,29,72,0.4)', transition: '0.2s'
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
            Start Recording
          </button>
        </div>
      )}

      {isRecording && (
        <div style={{ textAlign: 'center', margin: '20px 0', padding: '16px', background: 'rgba(225,29,72,0.08)', borderRadius: 12, border: '1px solid rgba(225,29,72,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e11d48', animation: 'pulse 1.5s infinite' }} />
            <span style={{ color: '#e11d48', fontWeight: 600, fontSize: 14 }}>Live Recording...</span>
            <span style={{ fontFamily: 'DM Mono, monospace', color: '#f87171', fontSize: 13 }}>{fmt(liveRecordingTime)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={cancelRecording}
              style={{
                padding: '8px 16px', background: 'transparent', color: '#f87171',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: '0.2s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={stopRecording}
              style={{
                padding: '8px 16px', background: '#181c24', color: '#e8eaf0',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: '0.2s'
              }}
            >
              Stop & Finalize
            </button>
          </div>
        </div>
      )}

      {/* Minimalistic Playback Header */}
      {hasAudio && meeting?.status === 'done' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          background: 'rgba(108,99,255,0.06)', padding: '10px 16px', borderRadius: 8,
          border: '1px solid rgba(108,99,255,0.15)'
        }}>
          <button
            onClick={togglePlay}
            title={isAudioPlaying ? 'Pause' : 'Play'}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c63ff, #00d4aa)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
              boxShadow: '0 2px 8px rgba(108,99,255,0.3)',
            }}
          >
            {isAudioPlaying ? '⏸' : '▶'}
          </button>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range" min={0} max={audioDuration || 100} step={0.1}
              value={audioTime}
              onChange={handleSeek}
              style={{ width: '100%', accentColor: '#6c63ff', cursor: 'pointer' }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'DM Mono, monospace' }}>
            {fmt(audioTime)} / {audioDuration ? fmt(audioDuration) : '--:--'}
          </div>
        </div>
      )}

      <Card title="Live Transcript" icon="📜">
        {/* Empty state */}
        {visibleSegments.length === 0 && (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
            {meeting?.status === 'uploaded'
              ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>🚀</div>
                  <div style={{ color: '#818cf8', fontWeight: 500, marginBottom: 6 }}>
                    Preparing for transcription...
                  </div>
                </div>
              )
              : isProcessing
              ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse 1s ease-in-out infinite', display: 'inline-block' }}>⚙️</div>
                  <div style={{ color: '#fbbf24', fontWeight: 500, marginBottom: 6 }}>
                    Transcribing audio…
                  </div>
                  <div style={{ fontSize: 12 }}>Please wait while we process the entire meeting</div>
                </div>
              )
              : hasAudio && !audioStarted && meeting?.status === 'done'
              ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>▶</div>
                  <div style={{ color: '#818cf8', fontWeight: 500, marginBottom: 6 }}>
                    Transcription complete!
                  </div>
                  <div style={{ fontSize: 12 }}>
                    Click play above to review the synchronized transcript
                  </div>
                </div>
              )
              : !hasAudio
              ? 'No transcript yet — upload an audio file to get started'
              : 'Waiting for transcript segments…'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleSegments.map((seg, i) => {
            const idx = speakerIndex(seg.speaker_label)
            const color = SPEAKER_COLORS[idx]
            const bg = SPEAKER_BG[idx]
            const name = nameMap[seg.speaker_label] || seg.speaker_name || seg.speaker_label || 'Unknown'
            const abbr = initials(seg.speaker_label)
            const sent = SENTIMENT_STYLES[seg.sentiment] || SENTIMENT_STYLES.neutral
            const isLast = i === visibleSegments.length - 1

            const isActive = hasAudio && isAudioPlaying && isLast

            return (
              <div
                key={seg.id || seg.segment_id || i}
                style={{
                  display: 'flex', gap: 12, padding: '10px 0',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  animation: 'fade-up 0.3s ease forwards',
                  ...(isActive ? {
                    background: 'rgba(108,99,255,0.05)',
                    borderRadius: 8,
                    padding: '10px 8px',
                    marginLeft: -8,
                    marginRight: -8,
                    borderBottom: 'none',
                  } : {}),
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: bg, color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 2,
                }}>{abbr}</div>

                <div style={{ flex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color }}>{name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'DM Mono, monospace' }}>{fmt(seg.start_time || 0)}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500,
                      background: sent.bg, color: sent.color,
                    }}>{sent.label}</span>
                    {seg.confidence && (
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{Math.round(seg.confidence * 100)}%</span>
                    )}
                    {isActive && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 10, color: '#34d399',
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
                        Now
                      </span>
                    )}
                  </div>
                  {/* Text */}
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e8eaf0' }}>{seg.text}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </Card>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
