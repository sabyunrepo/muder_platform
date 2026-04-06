import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioState {
  masterVolume: number; // 0-1
  sfxVolume: number; // 0-1
  bgmVolume: number; // 0-1 (UI 미노출, Phase E 확장용)
  isMuted: boolean;
}

export interface AudioActions {
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setBgmVolume: (v: number) => void;
  toggleMute: () => void;
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
      isMuted:
        typeof parsed.isMuted === "boolean" ? parsed.isMuted : undefined,
    };
  } catch {
    return {};
  }
}

function persistState(state: AudioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

const persisted = loadPersistedState();

const initialState: AudioState = {
  masterVolume: persisted.masterVolume ?? 0.8,
  sfxVolume: persisted.sfxVolume ?? 1,
  bgmVolume: persisted.bgmVolume ?? 0.5,
  isMuted: persisted.isMuted ?? false,
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

  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted }));
    persistState(get());
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectMasterVolume = (s: AudioState) => s.masterVolume;
export const selectSfxVolume = (s: AudioState) => s.sfxVolume;
export const selectBgmVolume = (s: AudioState) => s.bgmVolume;
export const selectIsMuted = (s: AudioState) => s.isMuted;
