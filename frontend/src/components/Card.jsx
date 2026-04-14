export default function Card({ title, icon, children, className = "", style }) {
  return (
    <div className={`liquid-glass-card p-6 font-['Inter'] ${className}`} style={style}>
      {(title || icon) && (
        <div className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6 flex items-center gap-2.5">
          {icon && <span className="text-sm opacity-60 transition-opacity hover:opacity-100">{icon}</span>}
          {title}
        </div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
