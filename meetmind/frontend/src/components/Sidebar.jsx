const icons = [
  { icon: '📊', label: 'Dashboard', active: true },
  { icon: '📅', label: 'Meetings' },
  { icon: '📈', label: 'Analytics' },
]

export default function Sidebar({ onHome }) {
  return (
    <div style={{
      width: 64, background: '#111318',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 0', gap: 8, flexShrink: 0,
    }}>
      <div
        onClick={onHome}
        style={{
          width: 36, height: 36, cursor: 'pointer',
          background: 'linear-gradient(135deg,#6c63ff,#00d4aa)',
          borderRadius: 10, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, marginBottom: 8,
        }}
        title="Home"
      >🎙</div>

      {icons.map((item) => (
        <div
          key={item.label}
          title={item.label}
          style={{
            width: 40, height: 40, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, transition: '0.15s',
            background: item.active ? 'rgba(108,99,255,0.2)' : 'transparent',
            color: item.active ? '#6c63ff' : '#6b7280',
          }}
        >{item.icon}</div>
      ))}

      <div style={{ flex: 1 }} />
      <div title="Settings" style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>⚙️</div>
    </div>
  )
}
