import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Calendar, BarChart3, Settings } from 'lucide-react'

const icons = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'meetings', icon: Calendar, label: 'Meetings' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
]

export default function Sidebar({ onHome, current }) {
  const navigate = useNavigate()
  return (
    <div className="w-[72px] bg-white/[0.02] backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0 relative z-20 h-screen">
      <div
        onClick={onHome}
        className="w-10 h-10 cursor-pointer bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] rounded-xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(108,99,255,0.3)] transition-transform hover:scale-110 active:scale-95"
        title="Home"
      >
        <div className="w-2.5 h-2.5 bg-black rounded-full shadow-[0_0_8px_white]"></div>
      </div>

      {icons.map((item) => {
        const isActive = current === item.id || (current === 'dashboard' && item.id === 'dashboard')
        const Icon = item.icon
        return (
          <div
            key={item.id}
            title={item.label}
            onClick={() => navigate(`/${item.id === 'dashboard' ? 'dashboard' : item.id}`)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 group ${
              isActive 
                ? 'bg-[#5ed29c]/10 text-[#5ed29c] shadow-[inset_0_0_10px_rgba(94,210,156,0.1)] border border-[#5ed29c]/30' 
                : 'text-white/20 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <Icon size={20} className={isActive ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
          </div>
        )
      })}

      <div className="flex-1" />
      
      <div 
        onClick={() => navigate('/settings')}
        title="Settings" 
        className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 group ${
          current === 'Settings' 
            ? 'bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/30' 
            : 'text-white/20 hover:text-white/60 hover:bg-white/5'
        }`}>
        <Settings size={20} className={current === 'Settings' ? '' : 'group-hover:rotate-45 transition-transform'} />
      </div>
    </div>
  )
}
