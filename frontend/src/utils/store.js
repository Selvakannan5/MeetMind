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
  processingProgress: 0,
  activeSpeaker: null,
  duration: 0,

  // Audio playback sync
  audioUrl: null,        // blob URL of uploaded audio
  audioTime: 0,         // current playback position (updated by onTimeUpdate — async)
  isAudioPlaying: false,
  revealUpTo: 0,         // EXPLICITLY set by pause/skip buttons — reliable for filtering

  // UI
  activeTab: 'live',
  toasts: [],

  // Actions
  setMeeting: (m) => set({ meeting: m }),
  setSegments: (s) => set({ segments: s }),
  setSpeakers: (s) => set({ speakers: s }),
  setActionItems: (a) => set({ actionItems: a }),
  setSummary: (s) => set({ summary: s }),
  setAnalytics: (a) => set({ analytics: a }),
  setActiveTab: (t) => set({ activeTab: t }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setAudioTime: (t) => set({ audioTime: t }),
  setIsAudioPlaying: (v) => set({ isAudioPlaying: v }),
  setRevealUpTo: (t) => set({ revealUpTo: t }),
  
  addToast: (msg, type = 'info') => set((state) => {
    const id = Date.now() + Math.random()
    return { toasts: [...state.toasts, { id, msg, type }] }
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  setIsRecording: (v) => set({ isRecording: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setProcessingProgress: (p) => set({ processingProgress: p }),
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
    processingProgress: 0,
    activeSpeaker: null,
    duration: 0,
    activeTab: 'live',
    audioUrl: null,
    audioTime: 0,
    isAudioPlaying: false,
    revealUpTo: 0,
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
