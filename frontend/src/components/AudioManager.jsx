/**
 * AudioManager — always mounted in DashboardPage.
 * Renders a hidden <audio> element that persists across tab switches,
 * continuously updating audioTime in the store.
 * Other components call play/pause via the exported audioRef.
 */
import { useMeetingStore } from '../utils/store'

// Module-level ref so any component can control playback without prop-drilling
export const audioRef = { current: null }

export default function AudioManager() {
  const { audioUrl, setAudioTime, setIsAudioPlaying } = useMeetingStore()

  if (!audioUrl) return null

  const syncTime = () => {
    if (audioRef.current) setAudioTime(audioRef.current.currentTime)
  }

  return (
    <audio
      // Callback ref: fires with DOM node on mount, null on unmount
      ref={(el) => { audioRef.current = el }}
      src={audioUrl}
      preload="metadata"
      style={{ display: 'none' }}
      onTimeUpdate={syncTime}     // fires ~4x/sec during playback
      onSeeked={syncTime}         // fires when user drags seek bar while paused
      onPlay={() => setIsAudioPlaying(true)}
      onPause={() => setIsAudioPlaying(false)}
      onEnded={() => setIsAudioPlaying(false)}
    />
  )
}
