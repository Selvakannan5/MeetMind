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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0c10', color: '#e8eaf0', fontFamily: 'Sora, sans-serif' }}>
      <Sidebar onHome={() => navigate('/')} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar meetingId={id} />
        <TabBar />

        {/* Content grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}>

          {/* Left scrollable panel */}
          <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {panels[activeTab] || panels.live}
          </div>

          {/* Right panel */}
          <RightPanel meetingId={id} />
        </div>
      </div>
    </div>
  )
}
