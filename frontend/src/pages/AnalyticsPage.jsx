import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGlobalAnalytics } from '../utils/api'
import Sidebar from '../components/Sidebar'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'

export default function AnalyticsPage() {
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

  // Mock trend data for visualization purposes
  const trendData = [
    { name: 'Mon', engagement: 65, duration: 120 },
    { name: 'Tue', engagement: 45, duration: 80 },
    { name: 'Wed', engagement: 85, duration: 210 },
    { name: 'Thu', engagement: 70, duration: 150 },
    { name: 'Fri', engagement: 90, duration: 240 },
    { name: 'Sat', engagement: 30, duration: 40 },
    { name: 'Sun', engagement: 50, duration: 60 },
  ]

  if (loading) return (
    <div className="flex h-screen bg-[#070b0a] items-center justify-center">
      <div className="text-white/20 animate-pulse font-['Inter'] font-black uppercase tracking-widest text-[11px]">
        Generating Visual Insights...
      </div>
    </div>
  )

  const pieData = [
    { name: 'Positive', value: stats.sentiment_distribution.positive, color: '#5ed29c' },
    { name: 'Neutral', value: stats.sentiment_distribution.neutral, color: '#6c63ff' },
    { name: 'Questioning', value: stats.sentiment_distribution.negative, color: '#fbbf24' },
  ]

  return (
    <div className="flex h-screen bg-[#070b0a] text-white">
      <Sidebar onHome={() => navigate('/')} current="analytics" />

      <main className="flex-1 flex flex-col overflow-y-auto relative z-10 font-['Inter']">
        
        {/* Header */}
        <div className="px-10 py-10 border-b border-white/5">
          <h1 className="text-[32px] font-black tracking-tighter uppercase text-white/90">Predictive Analytics</h1>
          <p className="text-white/40 text-[14px]">Advanced data visualization of your meeting intelligence trends.</p>
        </div>

        {/* Charts Grid */}
        <div className="p-10 space-y-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Engagement Trend */}
            <div className="liquid-glass-card p-8 min-h-[400px] flex flex-col">
              <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-10">Engagement Velocity (7D)</h2>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5ed29c" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#5ed29c" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f1412', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#5ed29c', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="engagement" stroke="#5ed29c" strokeWidth={3} fillOpacity={1} fill="url(#colorEngage)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sentiment Mix */}
            <div className="liquid-glass-card p-8 min-h-[400px] flex flex-col items-center">
              <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] self-start mb-4">Sentiment Distribution Mix</h2>
              <div className="flex-1 w-full flex flex-col sm:flex-row items-center justify-center gap-12">
                <div className="w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ backgroundColor: '#0f1412', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4 min-w-[150px]">
                  {pieData.map(item => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[12px] font-bold text-white/70 uppercase tracking-widest">{item.name}</span>
                      <span className="ml-auto text-[12px] font-black text-white">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Talk Time Chart */}
          <div className="liquid-glass-card p-8 min-h-[400px] flex flex-col">
            <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-10">Meeting Duration Heatmap</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f1412', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  />
                  <Line type="stepAfter" dataKey="duration" stroke="#6c63ff" strokeWidth={3} dot={{ fill: '#6c63ff', r: 4 }} activeDot={{ r: 8, stroke: '#6c63ff', strokeWidth: 10, strokeOpacity: 0.2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
