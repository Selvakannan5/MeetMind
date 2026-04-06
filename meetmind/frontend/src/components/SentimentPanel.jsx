import { useMeetingStore } from '../utils/store'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, Legend,
} from 'recharts'
import Card from './Card'

const SENTIMENT_COLORS = {
  positive:    '#34d399',
  negative:    '#f87171',
  neutral:     '#6b7280',
  questioning: '#fbbf24',
}

export default function SentimentPanel() {
  const { segments, analytics } = useMeetingStore()

  // Build timeline data from segments
  const timelineData = segments
    .filter(s => s.sentiment && s.sentiment_score)
    .map((s, i) => ({
      time: Math.floor(s.start_time / 60),
      score: s.sentiment === 'positive'
        ? s.sentiment_score * 100
        : s.sentiment === 'negative'
          ? (1 - s.sentiment_score) * 100
          : 50,
      sentiment: s.sentiment,
    }))

  // Bucket by minute
  const byMinute = {}
  timelineData.forEach(d => {
    if (!byMinute[d.time]) byMinute[d.time] = []
    byMinute[d.time].push(d.score)
  })
  const chartData = Object.entries(byMinute).map(([min, scores]) => ({
    minute: `${min}m`,
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }))

  // Breakdown
  const breakdown = analytics?.sentiment_breakdown || {}
  const pieData = [
    { name: 'Positive',    value: breakdown.positive    || 0, color: '#34d399' },
    { name: 'Neutral',     value: breakdown.neutral     || 0, color: '#6b7280' },
    { name: 'Questioning', value: breakdown.questioning || 0, color: '#fbbf24' },
    { name: 'Negative',    value: breakdown.negative    || 0, color: '#f87171' },
  ].filter(d => d.value > 0)

  // Keywords
  const keywords = (analytics?.top_keywords || []).slice(0, 16)

  return (
    <>
      {/* Emotion breakdown */}
      <Card title="Sentiment Breakdown" icon="💬">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
          {/* Pie */}
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#181c24', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }}
                formatter={(val) => [`${val.toFixed(1)}%`]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '😊 Positive',    value: breakdown.positive    || 0, color: '#34d399' },
              { label: '😐 Neutral',     value: breakdown.neutral     || 0, color: '#6b7280' },
              { label: '❓ Questioning', value: breakdown.questioning || 0, color: '#fbbf24' },
              { label: '😟 Negative',    value: breakdown.negative    || 0, color: '#f87171' },
            ].map(e => (
              <div key={e.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 3 }}>
                  <span>{e.label}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', color: e.color }}>{e.value.toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, background: '#181c24', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${e.value}%`, background: e.color, borderRadius: 3, transition: '0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Sentiment over time */}
      {chartData.length > 1 && (
        <Card title="Sentiment Over Time" icon="📈">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6c63ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="minute" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#181c24', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#6b7280' }}
                formatter={(v) => [`${v}%`, 'Positivity']}
              />
              <Area type="monotone" dataKey="score" stroke="#6c63ff" strokeWidth={2} fill="url(#sentGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <Card title="Top Keywords" icon="☁">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {keywords.map((kw, i) => {
              const size = 11 + Math.min(7, kw.score / 2)
              const opacity = 0.5 + Math.min(0.5, kw.count / 20)
              return (
                <span key={i} style={{
                  padding: '3px 9px', borderRadius: 6, fontSize: size,
                  fontWeight: kw.score > 3 ? 600 : 400,
                  background: '#181c24', border: '1px solid rgba(255,255,255,0.1)',
                  color: `rgba(232,234,240,${opacity})`, cursor: 'default',
                  transition: '0.15s',
                }}>
                  {kw.word}
                </span>
              )
            })}
          </div>
        </Card>
      )}

      {/* Per-segment sentiment log */}
      <Card title="Segment Sentiment Log" icon="🔍">
        {segments.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: 13 }}>No segments yet</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {segments.slice(-30).reverse().map((seg, i) => {
            const sc = SENTIMENT_COLORS[seg.sentiment] || '#6b7280'
            return (
              <div key={seg.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
                <span style={{ color: '#6b7280', fontFamily: 'DM Mono, monospace', flexShrink: 0, fontSize: 11 }}>
                  {Math.floor((seg.start_time||0)/60)}:{String(Math.floor((seg.start_time||0)%60)).padStart(2,'0')}
                </span>
                <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, background: `${sc}18`, color: sc, flexShrink: 0 }}>
                  {seg.sentiment}
                </span>
                <span style={{ color: '#9ca3af', lineHeight: 1.5 }}>{seg.text?.slice(0, 80)}{seg.text?.length > 80 ? '…' : ''}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}
