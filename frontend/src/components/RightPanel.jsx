import { useEffect, useRef, useState } from 'react'
import { useMeetingStore } from '../utils/store'

// ── Waveform ──────────────────────────────────────────────────────────────────
function Waveform({ isRecording }) {
  const barsRef = useRef([])
  const frameRef = useRef()
  const containerRef = useRef()

  useEffect(() => {
    if (!isRecording) return
    const animate = () => {
      barsRef.current.forEach((bar) => {
        if (!bar) return
        const h = isRecording
          ? 4 + Math.random() * 28
          : 4 + Math.abs(Math.sin(Date.now() / 600)) * 6
        bar.style.height = h + 'px'
      })
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [isRecording])

  return (
    <div
      ref={containerRef}
      style={{
        background: '#181c24', borderRadius: 8,
        height: 52, display: 'flex', alignItems: 'center',
        gap: 2, padding: '0 12px', overflow: 'hidden',
      }}
    >
      {Array.from({ length: 36 }).map((_, i) => (
        <div
          key={i}
          ref={(el) => (barsRef.current[i] = el)}
          style={{
            width: 3, height: 4, borderRadius: 2,
            background: '#6c63ff',
            opacity: 0.4 + (i % 5) * 0.12,
            transition: isRecording ? 'none' : 'height 0.4s ease',
          }}
        />
      ))}
    </div>
  )
}

// ── Topic Timeline ─────────────────────────────────────────────────────────────
function TopicTimeline() {
  const { analytics } = useMeetingStore()
  const topics = analytics?.topic_timeline || []

  if (topics.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>
        Topics will appear after processing
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {topics.map((t, i) => {
        const isLast = i === topics.length - 1
        const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
        return (
          <div key={i} style={{
            display: 'flex', gap: 10, paddingLeft: 14, paddingBottom: 12,
            borderLeft: '2px solid rgba(255,255,255,0.07)',
            marginLeft: 6, position: 'relative',
          }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: -5, top: 6,
              width: 8, height: 8, borderRadius: '50%',
              background: isLast ? '#6c63ff' : '#34d399',
              border: '2px solid #0a0c10',
            }} />
            <div>
              <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#6b7280', marginBottom: 2 }}>
                {fmtTime(t.start_time)}
              </div>
              <div style={{
                fontSize: 12, color: isLast ? '#818cf8' : '#e8eaf0',
                fontWeight: isLast ? 500 : 400,
              }}>{t.topic}</div>
              {t.keywords?.length > 0 && (
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  {t.keywords.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Speaking Now ──────────────────────────────────────────────────────────────
function SpeakingNow() {
  const { segments, speakers, isRecording } = useMeetingStore()

  const lastSeg = segments[segments.length - 1]
  const spkLabel = lastSeg?.speaker_label
  const speaker = speakers.find(s => s.label === spkLabel)
  const displayName = speaker?.name || spkLabel || (isRecording ? 'Detecting...' : 'None')

  const COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#3b82f6']
  const idx = spkLabel ? parseInt(spkLabel.replace(/\D/g, ''), 10) % COLORS.length : 0
  const color = spkLabel ? COLORS[idx] : '#6b7280'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: `${color}20`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 600,
      }}>
        {displayName.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color }}>{displayName}</div>
        {speaker && (
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Talk time: {Math.round(speaker.talk_time_seconds / 60)}m &nbsp;|&nbsp; {speaker.talk_percentage}% of meeting
          </div>
        )}
        {lastSeg?.sentiment && (
          <div style={{
            fontSize: 11, marginTop: 2,
            color: lastSeg.sentiment === 'positive' ? '#34d399' :
                   lastSeg.sentiment === 'negative' ? '#f87171' : '#6b7280',
          }}>
            Sentiment: {lastSeg.sentiment}
            {lastSeg.sentiment_score ? ` · ${Math.round(lastSeg.sentiment_score * 100)}%` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Engagement Score ──────────────────────────────────────────────────────────
function EngagementScore() {
  const { analytics } = useMeetingStore()
  const score = analytics?.engagement_score ?? null

  if (score === null) return null

  const color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171'
  const label = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Engagement</span>
        <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color }}>{score.toFixed(0)}% · {label}</span>
      </div>
      <div style={{ height: 6, background: '#181c24', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${score}%`,
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          borderRadius: 3, transition: '0.8s ease',
        }} />
      </div>
    </div>
  )
}

// ── Quick Notes ────────────────────────────────────────────────────────────────
function QuickNotes({ meetingId }) {
  const [text, setText] = useState(() => localStorage.getItem(`notes-${meetingId}`) || '')
  const [saved, setSaved] = useState('')
  const timerRef = useRef()

  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      localStorage.setItem(`notes-${meetingId}`, val)
      setSaved('Saved ' + new Date().toLocaleTimeString())
    }, 800)
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Jot quick notes here — saved locally…"
        style={{
          width: '100%', height: 100,
          background: '#181c24', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: '#e8eaf0', fontFamily: 'Sora, sans-serif',
          fontSize: 12, padding: 10, resize: 'none', outline: 'none', lineHeight: 1.6,
        }}
      />
      {saved && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{saved}</div>}
    </div>
  )
}

// ── Main RightPanel ──────────────────────────────────────────────────────────
const section = (title, children) => (
  <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: '#6b7280', marginBottom: 12,
    }}>{title}</div>
    {children}
  </div>
)

export default function RightPanel({ meetingId }) {
  const { isRecording, analytics } = useMeetingStore()

  return (
    <div style={{
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {section('🎙 Live Audio', (
        <>
          <Waveform isRecording={isRecording} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#6b7280' }}>
            <span>{isRecording ? '● Recording' : 'Not recording'}</span>
            <span style={{ color: '#34d399' }}>Whisper large-v3</span>
          </div>
        </>
      ))}

      {section('🎤 Speaking Now', <SpeakingNow />)}

      {analytics && section('📊 Engagement', <EngagementScore />)}

      {section('📌 Topic Flow', <TopicTimeline />)}

      {section('📝 Quick Notes', <QuickNotes meetingId={meetingId} />)}

      {/* Meeting stats footer */}
      {analytics && (
        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', marginBottom: 10 }}>
            📈 Meeting Stats
          </div>
          {[
            { label: 'Avg WPM',         value: analytics.avg_wpm },
            { label: 'Silence',         value: `${analytics.silence_percentage}%` },
            { label: 'Most active',     value: analytics.most_active_speaker || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#6b7280' }}>{label}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: '#e8eaf0' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
