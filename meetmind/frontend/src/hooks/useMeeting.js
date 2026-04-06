import { useEffect, useRef } from 'react'
import { useMeetingStore } from '../utils/store'
import {
  getMeeting, getSpeakers, getActionItems,
  getSummary, getAnalytics, getSegments,
} from '../utils/api'

export function useMeetingData(meetingId) {
  const {
    setMeeting, setSpeakers, setActionItems,
    setSummary, setAnalytics, setSegments, tickDuration,
  } = useMeetingStore()
  const timerRef = useRef(null)

  useEffect(() => {
    if (!meetingId) return

    const load = async () => {
      try {
        const [meetingRes, speakersRes, aiRes, segmentsRes] = await Promise.all([
          getMeeting(meetingId),
          getSpeakers(meetingId),
          getActionItems(meetingId),
          getSegments(meetingId),
        ])
        setMeeting(meetingRes.data)
        setSpeakers(speakersRes.data)
        setActionItems(aiRes.data)
        setSegments(segmentsRes.data)

        // Try to load summary + analytics (may not exist yet)
        try {
          const [summaryRes, analyticsRes] = await Promise.all([
            getSummary(meetingId),
            getAnalytics(meetingId),
          ])
          setSummary(summaryRes.data)
          setAnalytics(analyticsRes.data)
        } catch (_) {}

      } catch (err) {
        console.error('Failed to load meeting:', err)
      }
    }

    load()

    // Poll status every 5s when processing
    const pollRef = setInterval(async () => {
      try {
        const res = await getMeeting(meetingId)
        setMeeting(res.data)
        if (res.data.status === 'done') {
          // Reload everything once done
          load()
          clearInterval(pollRef)
        }
      } catch (_) {}
    }, 5000)

    // Tick duration timer
    timerRef.current = setInterval(tickDuration, 1000)

    return () => {
      clearInterval(pollRef)
      clearInterval(timerRef.current)
    }
  }, [meetingId])
}
