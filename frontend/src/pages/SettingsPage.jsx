import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, updateMe } from '../utils/api'
import Sidebar from '../components/Sidebar'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState({ name: '', email: '' })
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const r = await getMe()
      setUser(r.data)
      setEditName(r.data.name || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ text: '', type: '' })
    try {
      const r = await updateMe({ name: editName })
      setUser(r.data)
      setMessage({ text: 'Settings updated successfully!', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (err) {
      setMessage({ text: 'Failed to update settings. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#070b0a] text-white">
      <Sidebar onHome={() => navigate('/')} current="Settings" />

      <main className="flex-1 flex flex-col overflow-y-auto relative z-10 font-['Inter']">
        
        {/* Header */}
        <div className="px-10 py-10 border-b border-white/5">
          <h1 className="text-[32px] font-black tracking-tighter uppercase text-white/90">Settings</h1>
          <p className="text-white/40 text-[14px]">Manage your account and application preferences.</p>
        </div>

        {/* Content */}
        <div className="p-10 max-w-[900px] w-full space-y-12">
          
          {message.text && (
            <div className={`p-4 rounded-xl text-[13px] font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${
              message.type === 'success' ? 'bg-[#5ed29c]/10 border border-[#5ed29c]/20 text-[#5ed29c]' : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Profile Information</h2>
              {!loading && (
                <button 
                  onClick={handleSave}
                  disabled={saving || editName === user.name}
                  className="px-4 py-1.5 bg-[#5ed29c] disabled:bg-white/5 disabled:text-white/20 text-[#070b0a] text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all hover:scale-105 active:scale-95"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>

            <div className="liquid-glass-card p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest ml-1">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={loading || saving}
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-[#5ed29c]/50 p-4 rounded-xl text-white/90 text-[14px] outline-none transition-all placeholder:text-white/10"
                  placeholder="Your Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest ml-1">Email Address (Read-only)</label>
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-white/30 text-[14px] cursor-not-allowed">
                  {user.email || 'Loading...'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Application Preferences</h2>
            <div className="liquid-glass-card p-8 space-y-8">
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold text-white/90">Auto-Summarization</div>
                  <div className="text-[12px] text-white/40 mt-1 max-w-[400px]">Automatically generate summaries when a meeting finishes processing.</div>
                </div>
                <div className="w-11 h-6 bg-[#6c63ff] rounded-full relative cursor-pointer ring-4 ring-[#6c63ff]/20">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm" />
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold text-white/90">Theme Engine</div>
                  <div className="text-[12px] text-white/40 mt-1 max-w-[400px]">MeetMind currently uses the high-end <span className="text-[#5ed29c]">CodeNest</span> adaptive dark theme.</div>
                </div>
                <div className="w-11 h-6 bg-[#6c63ff] rounded-full relative opacity-50 ring-4 ring-[#6c63ff]/10">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm" />
                </div>
              </div>

            </div>
          </div>
          
          <button
            onClick={() => {
              localStorage.removeItem('token')
              window.location.href = '/'
            }}
            className="flex items-center gap-2 px-8 py-3.5 bg-red-500/10 border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-[14px] uppercase tracking-widest transition-all active:scale-95"
          >
            Log Out Account
          </button>

        </div>
      </main>
    </div>
  )
}
