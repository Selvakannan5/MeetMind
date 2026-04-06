import { create } from 'zustand'

export const useMeetingStore = create((set, get) => ({
  // Current meeting
  meeting: null,
  segments: [],
  speakers: [],
  actionItems: [],
  summary: null,
  analytics: null,

  // Live state
  isRecording: false,
  isProcessing: false,
  activeSpeaker: null,
  duration: 0,

  // UI
  activeTab: 'live',

  // Actions
  setMeeting: (m) => set({ meeting: m }),
  setSegments: (s) => set({ segments: s }),
  setSpeakers: (s) => set({ speakers: s }),
  setActionItems: (a) => set({ actionItems: a }),
  setSummary: (s) => set({ summary: s }),
  setAnalytics: (a) => set({ analytics: a }),
  setActiveTab: (t) => set({ activeTab: t }),
  setIsRecording: (v) => set({ isRecording: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setActiveSpeaker: (s) => set({ activeSpeaker: s }),

  addSegment: (seg) => set((state) => ({
    segments: [...state.segments, seg],
  })),

  tickDuration: () => set((state) => ({
    duration: state.duration + 1,
  })),

  resetMeeting: () => set({
    meeting: null,
    segments: [],
    speakers: [],
    actionItems: [],
    summary: null,
    analytics: null,
    isRecording: false,
    isProcessing: false,
    activeSpeaker: null,
    duration: 0,
    activeTab: 'live',
  }),

  toggleActionItem: (id) => set((state) => ({
    actionItems: state.actionItems.map((a) =>
      a.id === id ? { ...a, done: !a.done } : a
    ),
  })),

  updateSpeakerName: (id, name, role) => set((state) => ({
    speakers: state.speakers.map((s) =>
      s.id === id ? { ...s, name, role } : s
    ),
  })),
}))
