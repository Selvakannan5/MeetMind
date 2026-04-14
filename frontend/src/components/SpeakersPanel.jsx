import { useState } from 'react'
import { useMeetingStore } from '../utils/store'
import { updateSpeaker } from '../utils/api'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import Card from './Card'

const COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#3b82f6','#a78bfa']
const BG     = ['rgba(129,140,248,0.12)','rgba(52,211,153,0.12)','rgba(251,146,60,0.12)','rgba(244,114,182,0.12)','rgba(59,130,246,0.12)','rgba(167,139,250,0.12)']

function fmtTime(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}m ${String(s).padStart(2,'0')}s`
}

function SpeakerRow({ speaker, idx, meetingId }) {
  const { updateSpeakerName } = useMeetingStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(speaker.name || '')
  const [role, setRole] = useState(speaker.role || '')

  const handleSave = async () => {
    try {
      await updateSpeaker(meetingId, speaker.id, { name, role })
      updateSpeakerName(speaker.id, name, role)
    } catch (_) {}
    setEditing(false)
  }

  const color = COLORS[idx % COLORS.length]
  const bg    = BG[idx % BG.length]
  const abbr  = (speaker.name || speaker.label).slice(0, 2).toUpperCase()

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {abbr}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Name" style={inputStyle} />
              <input value={role} onChange={e => setRole(e.target.value)}
                placeholder="Role" style={{ ...inputStyle, width: 100 }} />
              <button onClick={handleSave} style={btnStyle('#6c63ff')}>Save</button>
              <button onClick={() => setEditing(false)} style={btnStyle('#374151')}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color }}>{speaker.name || speaker.label}</span>
              {speaker.role && <span style={{ fontSize: 11, color: '#6b7280' }}>{speaker.role}</span>}
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: 0 }}>✏</button>
            </div>
          )}

          {/* Talk bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#181c24', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${speaker.talk_percentage}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#6b7280', width: 34, textAlign: 'right' }}>{speaker.talk_percentage}%</span>
          </div>

          {/* Sentiment mini bar */}
          <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
            <div style={{ height: 3, borderRadius: 2, background: '#34d399', flex: speaker.positive_pct || 0 }} />
            <div style={{ height: 3, borderRadius: 2, background: '#6b7280', flex: speaker.neutral_pct || 0 }} />
            <div style={{ height: 3, borderRadius: 2, background: '#f87171', flex: speaker.negative_pct || 0 }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>⏱ <strong style={{ color: '#e8eaf0', fontFamily: 'DM Mono, monospace' }}>{fmtTime(speaker.talk_time_seconds)}</strong></span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>🔤 <strong style={{ color: '#e8eaf0', fontFamily: 'DM Mono, monospace' }}>{speaker.avg_wpm}</strong> wpm</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>💬 <strong style={{ color: '#e8eaf0', fontFamily: 'DM Mono, monospace' }}>{speaker.turn_count}</strong> turns</span>
        </div>
      </div>
    </div>
  )
}

export default function SpeakersPanel({ meetingId }) {
  const { speakers } = useMeetingStore()

  if (speakers.length === 0) {
    return (
      <Card title="Speakers" icon="👥">
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
          Speaker data will appear after processing
        </div>
      </Card>
    )
  }

  // Radar chart data
  const radarData = speakers.slice(0, 5).map((s, i) => ({
    name: s.name || s.label,
    'Talk %': s.talk_percentage,
    WPM:      Math.min(100, s.avg_wpm),
    Turns:    Math.min(100, s.turn_count * 5),
    Positive: s.positive_pct,
  }))

  return (
    <>
      <Card title="Speaker Analytics" icon="👥">
        {speakers.map((s, i) => (
          <SpeakerRow key={s.id} speaker={s} idx={i} meetingId={meetingId} />
        ))}
      </Card>

      <Card title="Participation Radar" icon="📡">
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={[
            { metric: 'Talk Time', ...Object.fromEntries(speakers.slice(0,4).map((s,i) => [s.name||s.label, s.talk_percentage])) },
            { metric: 'WPM',       ...Object.fromEntries(speakers.slice(0,4).map((s,i) => [s.name||s.label, Math.min(100,s.avg_wpm)])) },
            { metric: 'Turns',     ...Object.fromEntries(speakers.slice(0,4).map((s,i) => [s.name||s.label, Math.min(100,s.turn_count*5)])) },
            { metric: 'Positive',  ...Object.fromEntries(speakers.slice(0,4).map((s,i) => [s.name||s.label, s.positive_pct])) },
            { metric: 'Words',     ...Object.fromEntries(speakers.slice(0,4).map((s,i) => [s.name||s.label, Math.min(100, s.word_count/50)])) },
          ]}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} />
            {speakers.slice(0,4).map((s, i) => (
              <Radar
                key={s.id}
                name={s.name || s.label}
                dataKey={s.name || s.label}
                stroke={COLORS[i]}
                fill={COLORS[i]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{ background: '#181c24', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e8eaf0' }}
            />
          </RadarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {speakers.slice(0,4).map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i] }} />
              {s.name || s.label}
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

const inputStyle = {
  flex: 1, background: '#0a0c10', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '4px 10px', color: '#e8eaf0', fontSize: 12,
  fontFamily: 'Sora, sans-serif', outline: 'none',
}
const btnStyle = (bg) => ({
  padding: '4px 10px', background: bg, color: '#fff', border: 'none',
  borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
})
