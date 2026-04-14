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
    <div className="bg-white/[0.01] backdrop-blur-md border-b border-white/5 flex px-5 gap-2 shrink-0 relative z-20 font-['Inter']">
      {TABS.map((tab) => {
        const active = tab.key === activeTab
        return (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-4 text-[12px] font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap transition-all border-b-2 ${
              active 
                ? 'border-[#5ed29c] text-[#5ed29c]' 
                : 'border-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.02]'
            }`}
          >
            {tab.label}
          </div>
        )
      })}
    </div>
  )
}
