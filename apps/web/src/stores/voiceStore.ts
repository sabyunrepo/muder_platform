import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceState {
  isVoiceEnabled: boolean;
  currentChannel: string | null;
  isMuted: boolean;
  isSpeakerMuted: boolean;
  isPanelOpen: boolean;
  isBottomSheetOpen: boolean;
  connectionState: "disconnected" | "connecting" | "connected" | "error";
}

export interface VoiceActions {
  setVoiceEnabled: (enabled: boolean) => void;
  setCurrentChannel: (channel: string | null) => void;
  toggleMute: () => void;
  toggleSpeakerMute: () => void;
  togglePanel: () => void;
  toggleBottomSheet: () => void;
  setConnectionState: (state: VoiceState["connectionState"]) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const initialState: VoiceState = {
  isVoiceEnabled: false,
  currentChannel: null,
  isMuted: false,
  isSpeakerMuted: false,
  isPanelOpen: true,
  isBottomSheetOpen: false,
  connectionState: "disconnected",
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useVoiceStore = create<VoiceState & VoiceActions>()((set) => ({
  ...initialState,

  setVoiceEnabled: (enabled) => {
    set({ isVoiceEnabled: enabled });
  },

  setCurrentChannel: (channel) => {
    set({ currentChannel: channel });
  },

  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted }));
  },

  toggleSpeakerMute: () => {
    set((s) => ({ isSpeakerMuted: !s.isSpeakerMuted }));
  },

  togglePanel: () => {
    set((s) => ({ isPanelOpen: !s.isPanelOpen }));
  },

  toggleBottomSheet: () => {
    set((s) => ({ isBottomSheetOpen: !s.isBottomSheetOpen }));
  },

  setConnectionState: (state) => {
    set({ connectionState: state });
  },

  reset: () => {
    set(initialState);
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectIsVoiceEnabled = (s: VoiceState) => s.isVoiceEnabled;
export const selectCurrentChannel = (s: VoiceState) => s.currentChannel;
export const selectIsMuted = (s: VoiceState) => s.isMuted;
export const selectIsSpeakerMuted = (s: VoiceState) => s.isSpeakerMuted;
export const selectIsPanelOpen = (s: VoiceState) => s.isPanelOpen;
export const selectIsBottomSheetOpen = (s: VoiceState) => s.isBottomSheetOpen;
export const selectVoiceConnectionState = (s: VoiceState) => s.connectionState;
