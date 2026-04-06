import { useMeetingStore } from '../utils/store'

const TABS = [
  { key: 'live',      label: '🔴 Live' },
  { key: 'summary',   label: '📝 Summary' },
  { key: 'speakers',  label: '👥 Speakers' },
  { key: 'sentiment', label: '💬 Sentiment' },
  { key: 'upload',    label: '⬆ Upload' },
]

export default function TabBar() {
  const { activeTab, setActiveTab } = useMeetingStore()

  return (
    <div style={{
      background: '#111318',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', padding: '0 20px', gap: 4, flexShrink: 0,
    }}>
      {TABS.map((tab) => {
        const active = tab.key === activeTab
        return (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 16px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: active ? '2px solid #6c63ff' : '2px solid transparent',
              color: active ? '#6c63ff' : '#6b7280',
              transition: '0.15s',
            }}
          >{tab.label}</div>
        )
      })}
    </div>
  )
}
