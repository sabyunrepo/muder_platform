import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types — wire format from server (camelCase, post A9 bridge conversion)
// ---------------------------------------------------------------------------

export interface ReadingLineWire {
  index: number;
  text: string;
  speaker?: string;
  voiceMediaId?: string;
  /** "voice" | "gm" | `role:${string}` | "" */
  advanceBy: string;
}

export type ReadingStatus = "idle" | "playing" | "paused" | "completed";

export interface ReadingStateSnapshot {
  sectionId: string;
  lines: ReadingLineWire[];
  currentIndex: number;
  bgmMediaId?: string;
  status: ReadingStatus;
  pausedReason?: string;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ReadingStoreState {
  sectionId: string | null;
  lines: ReadingLineWire[];
  currentIndex: number;
  status: ReadingStatus;
  pausedReason: string | null;

  // actions — fed from useGameMediaEvents (F3)
  startSection(sectionId: string, lines: ReadingLineWire[]): void;
  showLine(index: number): void;
  pauseSection(reason: string): void;
  resumeSection(): void;
  completeSection(): void;
  restoreFromSnapshot(snapshot: ReadingStateSnapshot): void;
  clear(): void;

  // selectors (derived data accessors)
  getCurrentLine(): ReadingLineWire | null;
  getTotalLines(): number;
  isAtLastLine(): boolean;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  sectionId: null as string | null,
  lines: [] as ReadingLineWire[],
  currentIndex: 0,
  status: "idle" as ReadingStatus,
  pausedReason: null as string | null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReadingStore = create<ReadingStoreState>()((set, get) => ({
  ...initialState,

  startSection: (sectionId, lines) => {
    set({
      sectionId,
      lines,
      currentIndex: 0,
      status: "playing",
      pausedReason: null,
    });
  },

  showLine: (index) => {
    const { lines } = get();
    if (lines.length === 0) {
      return;
    }
    const clamped = Math.min(Math.max(0, index), lines.length - 1);
    set({ currentIndex: clamped });
  },

  pauseSection: (reason) => {
    set({ status: "paused", pausedReason: reason });
  },

  resumeSection: () => {
    if (get().status !== "paused") {
      return;
    }
    set({ status: "playing", pausedReason: null });
  },

  completeSection: () => {
    set({ status: "completed" });
  },

  restoreFromSnapshot: (snapshot) => {
    set({
      sectionId: snapshot.sectionId,
      lines: snapshot.lines,
      currentIndex: snapshot.currentIndex,
      status: snapshot.status,
      pausedReason: snapshot.pausedReason ?? null,
    });
  },

  clear: () => {
    set({ ...initialState });
  },

  getCurrentLine: () => {
    const { lines, currentIndex, status } = get();
    if (status === "idle") return null;
    if (currentIndex < 0 || currentIndex >= lines.length) return null;
    return lines[currentIndex] ?? null;
  },

  getTotalLines: () => get().lines.length,

  isAtLastLine: () => {
    const { lines, currentIndex } = get();
    if (lines.length === 0) return false;
    return currentIndex === lines.length - 1;
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSectionId = (s: ReadingStoreState) => s.sectionId;
export const selectLines = (s: ReadingStoreState) => s.lines;
export const selectCurrentIndex = (s: ReadingStoreState) => s.currentIndex;
export const selectStatus = (s: ReadingStoreState) => s.status;
export const selectPausedReason = (s: ReadingStoreState) => s.pausedReason;
export const selectCurrentLine = (s: ReadingStoreState) => s.getCurrentLine();
export const selectIsPaused = (s: ReadingStoreState) => s.status === "paused";
