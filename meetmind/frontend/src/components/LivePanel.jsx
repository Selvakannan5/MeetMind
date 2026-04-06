import { useEffect, useRef } from 'react'
import { useMeetingStore } from '../utils/store'
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

function StatsGrid() {
  const { segments, meeting } = useMeetingStore()
  const total = segments.length
  const pos = segments.filter(s => s.sentiment === 'positive').length
  const sentPct = total > 0 ? Math.round(pos / total * 100) : 0
  const words = segments.reduce((acc, s) => acc + (s.text || '').split(' ').length, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 0 }}>
      {[
        { label: 'Duration',     value: meeting?.duration_seconds ? fmt(meeting.duration_seconds) : '—', color: '#f59e0b' },
        { label: 'Words spoken', value: words.toLocaleString(), color: '#818cf8', sub: 'total' },
        { label: 'Segments',     value: total, color: '#34d399', sub: 'transcribed' },
        { label: 'Sentiment',    value: `${sentPct}%`, color: '#34d399', sub: 'positive' },
      ].map((s) => (
        <div key={s.label} style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: s.color }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export default function LivePanel() {
  const { segments, speakers } = useMeetingStore()
  const bottomRef = useRef(null)

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments.length])

  // Build speaker name map
  const nameMap = {}
  speakers.forEach((s) => { nameMap[s.label] = s.name || s.label })

  return (
    <>
      <StatsGrid />

      <Card title="Live Transcript" icon="📜">
        {segments.length === 0 && (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
            No transcript yet — start recording or upload a file
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {segments.map((seg, i) => {
            const idx = speakerIndex(seg.speaker_label)
            const color = SPEAKER_COLORS[idx]
            const bg = SPEAKER_BG[idx]
            const name = nameMap[seg.speaker_label] || seg.speaker_name || seg.speaker_label || 'Unknown'
            const abbr = initials(seg.speaker_label)
            const sent = SENTIMENT_STYLES[seg.sentiment] || SENTIMENT_STYLES.neutral
            const isLast = i === segments.length - 1

            return (
              <div
                key={seg.id || i}
                style={{
                  display: 'flex', gap: 12, padding: '10px 0',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  animation: 'fade-up 0.3s ease forwards',
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
    </>
  )
}
