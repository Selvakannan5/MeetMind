import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useMeetingStore } from '../utils/store'
import { useMeetingData } from '../hooks/useMeeting'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import TabBar from '../components/TabBar'
import LivePanel from '../components/LivePanel'
import SummaryPanel from '../components/SummaryPanel'
import SpeakersPanel from '../components/SpeakersPanel'
import SentimentPanel from '../components/SentimentPanel'
import UploadPanel from '../components/UploadPanel'
import RightPanel from '../components/RightPanel'
import AudioManager from '../components/AudioManager'

export default function DashboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeTab, resetMeeting } = useMeetingStore()

  useMeetingData(id)

  useEffect(() => () => resetMeeting(), [])

  const panels = {
    live:      <LivePanel meetingId={id} />,
    summary:   <SummaryPanel meetingId={id} />,
    speakers:  <SpeakersPanel meetingId={id} />,
    sentiment: <SentimentPanel meetingId={id} />,
    upload:    <UploadPanel meetingId={id} />,
  }

  return (
    <div className="flex h-screen overflow-hidden font-['Inter'] relative text-white/90">
      {/* Persistent audio element — survives tab switches */}
      <AudioManager />
      <Sidebar onHome={() => navigate('/')} />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <TopBar meetingId={id} />
        <TabBar />

        {/* Content grid */}
        <div className="flex-1 grid grid-cols-[1fr_340px] overflow-hidden">

          {/* Left scrollable panel */}
          <div className="overflow-y-auto p-5 flex flex-col gap-4">
            {panels[activeTab] || panels.live}
          </div>

          {/* Right panel */}
          <RightPanel meetingId={id} />
        </div>
      </div>
    </div>
  )
}
