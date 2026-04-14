import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGlobalAnalytics } from '../utils/api'
import Sidebar from '../components/Sidebar'
import { Activity, Clock, Users, Zap, ArrowUpRight } from 'lucide-react'
import WaveformAnimation from '../components/landing/WaveformAnimation'

export default function GlobalDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await getGlobalAnalytics()
      setStats(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  }

  if (loading) return (
    <div className="flex h-screen bg-[#070b0a] items-center justify-center">
      <div className="text-white/20 animate-pulse font-['Inter'] font-black uppercase tracking-widest text-[11px]">
        Loading Intelligence...
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#070b0a] text-white">
      <Sidebar onHome={() => navigate('/')} current="dashboard" />

      <main className="flex-1 flex flex-col overflow-y-auto relative z-10 font-['Inter']">
        
        {/* Header Section */}
        <div className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-black tracking-tighter uppercase text-white/90">Intelligence Hub</h1>
            <p className="text-white/40 text-[14px]">Your global meeting productivity and sentiment overview.</p>
          </div>
          <div className="hidden lg:block w-48">
            <WaveformAnimation />
          </div>
        </div>

        {/* Content */}
        <div className="p-10 space-y-10">
          
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="Total Meetings" 
              value={stats.total_meetings} 
              icon={Activity} 
              color="#5ed29c" 
            />
            <StatCard 
              label="Recorded Time" 
              value={formatDuration(stats.total_duration)} 
              icon={Clock} 
              color="#6c63ff" 
            />
            <StatCard 
              label="Intelligence Words" 
              value={stats.total_words.toLocaleString()} 
              icon={Zap} 
              color="#fbbf24" 
            />
            <StatCard 
              label="Engagement Score" 
              value={`${stats.avg_engagement}%`} 
              icon={Users} 
              color="#00d4aa" 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Sentiment Breakdown */}
            <div className="lg:col-span-1 liquid-glass-card p-8 space-y-6">
              <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Global Sentiment</h2>
              <div className="space-y-4">
                <SentimentBar label="Positive" pct={stats.sentiment_distribution.positive} color="#5ed29c" />
                <SentimentBar label="Neutral" pct={stats.sentiment_distribution.neutral} color="#6c63ff" />
                <SentimentBar label="Questioning" pct={stats.sentiment_distribution.negative} color="#fbbf24" />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2 liquid-glass-card p-8 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Recent Activity</h2>
                <button 
                  onClick={() => navigate('/meetings')}
                  className="text-[11px] font-bold text-[#5ed29c] uppercase tracking-widest hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4 flex-1">
                {stats.recent_activity.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => navigate(`/meeting/${item.id}`)}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#5ed29c] animate-pulse"></div>
                      <span className="text-[14px] font-bold text-white/80 group-hover:text-white transition-colors">{item.title}</span>
                    </div>
                    <ArrowUpRight size={16} className="text-white/20 group-hover:text-[#5ed29c] transition-all" />
                  </div>
                ))}
                {stats.recent_activity.length === 0 && (
                  <div className="flex items-center justify-center h-full text-white/20 text-[13px] italic">
                    No recent meetings found...
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="liquid-glass-card p-6 flex items-center gap-5 group hover:scale-[1.02] transition-transform">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/[0.03] border border-white/5 transition-colors group-hover:border-white/20">
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{label}</div>
        <div className="text-[20px] font-black text-white/90 group-hover:text-white mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function SentimentBar({ label, pct, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
        <span className="text-white/40">{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }}></div>
      </div>
    </div>
  )
}
