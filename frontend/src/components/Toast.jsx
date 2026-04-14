import { useEffect } from 'react'
import { useMeetingStore } from '../utils/store'

export default function ToastContainer() {
  const { toasts, removeToast } = useMeetingStore()

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove()
    }, 4000)
    return () => clearTimeout(timer)
  }, [onRemove])

  const colors = {
    info: { bg: 'rgba(108, 99, 255, 0.9)', border: 'rgba(108, 99, 255, 1)' },
    success: { bg: 'rgba(0, 212, 170, 0.9)', border: 'rgba(0, 212, 170, 1)' },
    error: { bg: 'rgba(239, 68, 68, 0.9)', border: 'rgba(239, 68, 68, 1)' },
  }
  const color = colors[toast.type] || colors.info

  return (
    <div className="animate-fade-up glass-card" style={{
      background: color.bg,
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 500,
      borderLeft: `4px solid ${color.border}`,
      boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }}>
      {toast.type === 'success' && <span>✓</span>}
      {toast.type === 'error' && <span>⚠</span>}
      {toast.type === 'info' && <span>ℹ</span>}
      <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)', flex: 1, marginRight: 8, lineHeight: 1.4 }}>{toast.msg}</span>
      <button 
        onClick={onRemove}
        aria-label="Close"
        style={{
          background: 'none', border: 'none', padding: 0,
          color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
      >
        ×
      </button>
    </div>
  )
}
