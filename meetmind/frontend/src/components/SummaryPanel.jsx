import { useState } from 'react'
import { useMeetingStore } from '../utils/store'
import { updateActionItem } from '../utils/api'
import Card from './Card'

export default function SummaryPanel({ meetingId }) {
  const { summary, actionItems, toggleActionItem } = useMeetingStore()

  const handleToggle = async (item) => {
    toggleActionItem(item.id)
    try {
      await updateActionItem(meetingId, item.id, { done: !item.done })
    } catch (_) {}
  }

  if (!summary) {
    return (
      <Card title="Summary" icon="📝">
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
          Summary will appear here after the meeting is processed
        </div>
      </Card>
    )
  }

  return (
    <>
      {/* Overview */}
      <Card title="Overview" icon="📝">
        <p style={{ fontSize: 13, lineHeight: 1.75, color: '#e8eaf0' }}>{summary.overview}</p>
      </Card>

      {/* Key Points */}
      {summary.key_points?.length > 0 && (
        <Card title="Key Points" icon="💡">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {summary.key_points.map((kp, i) => (
              <span key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                background: '#181c24', border: '1px solid rgba(255,255,255,0.12)', color: '#e8eaf0',
              }}>{kp}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Topics */}
      {summary.topics?.length > 0 && (
        <Card title="Topics Discussed" icon="🗂">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {summary.topics.map((t, i) => (
              <span key={i} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)', color: '#818cf8',
              }}>{t}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Decisions */}
      {summary.decisions?.length > 0 && (
        <Card title="Decisions Made" icon="✅">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.decisions.map((d, i) => (
              <div key={i} style={{
                padding: '10px 14px', background: 'rgba(52,211,153,0.06)',
                borderLeft: '3px solid #34d399', borderRadius: '0 8px 8px 0', fontSize: 13,
              }}>{d}</div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Items */}
      <Card title="Action Items" icon="📋">
        {actionItems.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: 13 }}>No action items found</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actionItems.map((item) => (
            <ActionItem key={item.id} item={item} onToggle={() => handleToggle(item)} />
          ))}
        </div>
      </Card>
    </>
  )
}

function ActionItem({ item, onToggle }) {
  const priorityColors = {
    high:   { border: '#f87171', bg: 'rgba(239,68,68,0.06)' },
    medium: { border: '#6c63ff', bg: 'rgba(108,99,255,0.06)' },
    low:    { border: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
  }
  const pc = priorityColors[item.priority] || priorityColors.medium

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: item.done ? 'rgba(52,211,153,0.04)' : pc.bg,
      borderLeft: `3px solid ${item.done ? '#34d399' : pc.border}`,
      borderRadius: '0 8px 8px 0', padding: '10px 12px',
      opacity: item.done ? 0.65 : 1, transition: '0.2s',
    }}>
      {/* Checkbox */}
      <div
        onClick={onToggle}
        style={{
          width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${item.done ? '#34d399' : 'rgba(255,255,255,0.2)'}`,
          background: item.done ? '#34d399' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 10, color: '#000', flexShrink: 0, marginTop: 1,
        }}
      >{item.done ? '✓' : ''}</div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, textDecoration: item.done ? 'line-through' : 'none' }}>
          {item.task}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, display: 'flex', gap: 12 }}>
          {item.owner && <span>👤 {item.owner}</span>}
          {item.deadline && <span>📅 {item.deadline}</span>}
          <span style={{
            padding: '1px 6px', borderRadius: 4, fontSize: 10,
            background: item.priority === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
            color: item.priority === 'high' ? '#f87171' : '#9ca3af',
          }}>{item.priority}</span>
        </div>
      </div>
    </div>
  )
}
