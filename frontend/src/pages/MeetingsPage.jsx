import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMeeting, listMeetings, deleteMeeting } from '../utils/api'
import { formatDistanceToNow } from 'date-fns'
import Sidebar from '../components/Sidebar'
import { Plus, Trash2, Calendar, Users, FileText } from 'lucide-react'

const STATUS_COLORS = {
  live: { dot: '#f87171', label: 'Live', bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
  processing: { dot: '#fbbf24', label: 'Processing', bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  done: { dot: '#34d399', label: 'Done', bg: 'rgba(52,211,153,0.12)', text: '#34d399' },
  error: { dot: '#f87171', label: 'Error', bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
}

export default function MeetingsPage() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = () => {
    setLoading(true)
    listMeetings()
      .then((r) => setMeetings(r.data))
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this meeting?')) return
    try {
      await deleteMeeting(id)
      fetchMeetings()
    } catch (err) {
      alert('Failed to delete meeting')
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await createMeeting(title.trim())
      navigate(`/meeting/${res.data.id}`)
    } catch (err) {
      alert('Failed to create meeting: ' + (err.response?.data?.detail || err.message))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#070b0a] text-white">
      <Sidebar onHome={() => navigate('/')} current="meetings" />

      <main className="flex-1 flex flex-col overflow-y-auto relative z-10 font-['Inter']">

        {/* Header */}
        <div className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-black tracking-tighter uppercase text-white/90">Meetings Archive</h1>
            <p className="text-white/40 text-[14px]">Access and manage your recorded meeting library.</p>
          </div>
        </div>

        <div className="p-10 max-w-[1200px] w-full mx-auto space-y-12">

          {/* New meeting card */}
          <div className="liquid-glass-card p-8">
            <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6 ml-1">Launch New Session</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Meeting name (e.g. Q3 Strategy Sync)"
                className="flex-1 bg-white/[0.03] border border-white/10 focus:border-[#5ed29c]/50 text-white rounded-xl py-4 px-6 outline-none transition-all placeholder:text-white/10 font-['Inter']"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="bg-[#5ed29c] hover:bg-[#4bc28a] disabled:bg-white/10 disabled:text-white/20 text-[#070b0a] font-bold uppercase text-[12px] px-8 py-4 rounded-xl transition-all hover:scale-[1.05] active:scale-95 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(94,210,156,0.2)]"
              >
                <Plus size={18} />
                {creating ? 'Initializing...' : 'Start Meeting'}
              </button>
            </div>
          </div>

          {/* List Section */}
          <div className="space-y-6">
            <h2 className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">All Recorded Intelligence</h2>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-white/10 text-[13px] font-black uppercase tracking-[0.3em] animate-pulse">
                Accessing archives...
              </div>
            ) : meetings.length === 0 ? (
              <div className="liquid-glass-card p-20 text-center text-white/20 text-[14px] italic">
                No meeting data found. Create a new session to begin.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {meetings.map((m) => {
                  const sc = STATUS_COLORS[m.status] || STATUS_COLORS.done
                  const ago = m.started_at ? formatDistanceToNow(new Date(m.started_at), { addSuffix: true }) : ''
                  const dur = m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}m` : '0m'
                  return (
                    <div
                      key={m.id}
                      onClick={() => navigate(`/meeting/${m.id}`)}
                      className="liquid-glass-card p-6 cursor-pointer flex items-center gap-6 transition-all hover:bg-white/[0.03] group border border-transparent hover:border-white/10 active:scale-[0.99]"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-[#5ed29c] group-hover:bg-[#5ed29c]/10 group-hover:border-[#5ed29c]/20 transition-all shadow-xl">
                        <FileText size={24} />
                      </div>

                      <div className="flex-1">
                        <div className="text-[17px] font-bold text-white/90 group-hover:text-white transition-colors">{m.title}</div>
                        <div className="flex items-center gap-4 mt-1.5 overflow-hidden">
                          <div className="flex items-center gap-1.5 text-[12px] text-white/30 whitespace-nowrap">
                            <Calendar size={13} /> {ago}
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-white/30 whitespace-nowrap">
                            <Users size={13} /> {m.participant_count} speakers
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#5ed29c]/40 font-bold whitespace-nowrap">
                            {dur}
                          </div>
                        </div>
                      </div>

                      <div className="hidden md:flex px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest items-center gap-2" style={{ color: sc.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }}></span>
                        {sc.label}
                      </div>

                      <button
                        onClick={(e) => handleDelete(e, m.id)}
                        className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Delete meeting"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

