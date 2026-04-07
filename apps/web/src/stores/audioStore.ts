import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioState {
  masterVolume: number; // 0-1
  sfxVolume: number; // 0-1
  bgmVolume: number; // 0-1 (UI 미노출, Phase E 확장용)
  voiceVolume: number; // 0-1 (LiveKit voice channel, Phase 7.7)
  isMuted: boolean;
  bgmMediaId: string | null; // 현재 재생 중인 BGM media id (재접속 복원용, 세션 한정)
}

export interface AudioActions {
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setBgmVolume: (v: number) => void;
  setVoiceVolume: (v: number) => void;
  toggleMute: () => void;
  setBgmMediaId: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mmp-audio-settings";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function loadPersistedState(): Partial<AudioState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AudioState>;
    return {
      masterVolume:
        typeof parsed.masterVolume === "number"
          ? clamp01(parsed.masterVolume)
          : undefined,
      sfxVolume:
        typeof parsed.sfxVolume === "number"
          ? clamp01(parsed.sfxVolume)
          : undefined,
      bgmVolume:
        typeof parsed.bgmVolume === "number"
          ? clamp01(parsed.bgmVolume)
          : undefined,
      voiceVolume:
        typeof parsed.voiceVolume === "number"
          ? clamp01(parsed.voiceVolume)
          : undefined,
      isMuted:
        typeof parsed.isMuted === "boolean" ? parsed.isMuted : undefined,
    };
  } catch {
    return {};
  }
}

function persistState(state: AudioState): void {
  try {
    // bgmMediaId is session-scoped — do NOT persist
    const { bgmMediaId: _omit, ...persistable } = state;
    void _omit;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // quota exceeded — ignore
  }
}

const persisted = loadPersistedState();

const initialState: AudioState = {
  masterVolume: persisted.masterVolume ?? 0.8,
  sfxVolume: persisted.sfxVolume ?? 1,
  bgmVolume: persisted.bgmVolume ?? 0.5,
  voiceVolume: persisted.voiceVolume ?? 1,
  isMuted: persisted.isMuted ?? false,
  bgmMediaId: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAudioStore = create<AudioState & AudioActions>()((set, get) => ({
  ...initialState,

  setMasterVolume: (v) => {
    set({ masterVolume: clamp01(v) });
    persistState(get());
  },

  setSfxVolume: (v) => {
    set({ sfxVolume: clamp01(v) });
    persistState(get());
  },

  setBgmVolume: (v) => {
    set({ bgmVolume: clamp01(v) });
    persistState(get());
  },

  setVoiceVolume: (v) => {
    set({ voiceVolume: clamp01(v) });
    persistState(get());
  },

  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted }));
    persistState(get());
  },

  setBgmMediaId: (id) => {
    set({ bgmMediaId: id });
    // intentionally NOT persisted — session-scoped
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectMasterVolume = (s: AudioState) => s.masterVolume;
export const selectSfxVolume = (s: AudioState) => s.sfxVolume;
export const selectBgmVolume = (s: AudioState) => s.bgmVolume;
export const selectVoiceVolume = (s: AudioState) => s.voiceVolume;
export const selectIsMuted = (s: AudioState) => s.isMuted;
export const selectBgmMediaId = (s: AudioState) => s.bgmMediaId;
