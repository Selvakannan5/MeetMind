import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMeeting, listMeetings } from '../utils/api'
import { formatDistanceToNow } from 'date-fns'

const STATUS_COLORS = {
  live:       { dot: '#f87171', label: 'Live',       bg: 'rgba(239,68,68,0.12)',    text: '#f87171' },
  processing: { dot: '#fbbf24', label: 'Processing', bg: 'rgba(245,158,11,0.12)',   text: '#fbbf24' },
  done:       { dot: '#34d399', label: 'Done',        bg: 'rgba(52,211,153,0.12)',   text: '#34d399' },
  error:      { dot: '#f87171', label: 'Error',       bg: 'rgba(239,68,68,0.12)',    text: '#f87171' },
}

export default function MeetingsPage() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [title, setTitle]       = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    listMeetings()
      .then((r) => setMeetings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await createMeeting(title.trim())
      navigate(`/meeting/${res.data.id}`)
    } catch (err) {
      alert('Failed to create meeting: ' + (err.response?.data?.detail || err.message))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c10', color: '#e8eaf0', fontFamily: 'Sora, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#111318', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#6c63ff,#00d4aa)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎙</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>MeetMind</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Meeting Intelligence Platform</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 36, fontWeight: 600, marginBottom: 12, background: 'linear-gradient(90deg,#818cf8,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Intelligent Meeting Analysis
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Live transcription · Speaker diarization · Sentiment analysis · Auto summaries
          </p>
        </div>

        {/* New meeting card */}
        <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 28, marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Start New Meeting
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Meeting title (e.g. Sprint 10 Planning)"
              style={{
                flex: 1, background: '#181c24', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: '10px 16px', color: '#e8eaf0', fontSize: 14,
                fontFamily: 'Sora, sans-serif', outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              style={{
                padding: '10px 24px', background: creating ? '#444' : '#6c63ff',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
                fontWeight: 500, cursor: creating ? 'not-allowed' : 'pointer',
                fontFamily: 'Sora, sans-serif', transition: '0.15s',
              }}
            >
              {creating ? 'Creating...' : '🎙 Start'}
            </button>
          </div>
        </div>

        {/* Past meetings */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Recent Meetings
          </div>

          {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>Loading...</div>}

          {!loading && meetings.length === 0 && (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 48, background: '#111318', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
              No meetings yet — start one above
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meetings.map((m) => {
              const sc = STATUS_COLORS[m.status] || STATUS_COLORS.done
              const ago = m.started_at ? formatDistanceToNow(new Date(m.started_at), { addSuffix: true }) : ''
              const dur = m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}m` : '—'
              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/meeting/${m.id}`)}
                  style={{
                    background: '#111318', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 16,
                    transition: '0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                >
                  <div style={{ fontSize: 24 }}>📋</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {ago} · {m.participant_count} speakers · {m.word_count.toLocaleString()} words · {dur}
                    </div>
                  </div>
                  <div style={{ padding: '4px 12px', background: sc.bg, color: sc.text, borderRadius: 20, fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }}></span>
                    {sc.label}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 18 }}>›</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
