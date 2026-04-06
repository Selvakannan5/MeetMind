export default function Card({ title, icon, children, style }) {
  return (
    <div style={{
      background: '#111318', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: 16, ...style,
    }}>
      {(title || icon) && (
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#6b7280', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
          {title}
        </div>
      )}
      {children}
    </div>
  )
}
