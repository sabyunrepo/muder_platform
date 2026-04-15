import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatEntry {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  ts: number;
  isWhisper?: boolean;
  isMine?: boolean;
}

export interface GameChatState {
  messages: ChatEntry[];
  whisperMessages: ChatEntry[];
}

export interface GameChatActions {
  addMessage: (entry: ChatEntry) => void;
  addWhisperMessage: (entry: ChatEntry) => void;
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appendCapped(prev: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  const next = [...prev, entry];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameChatStore = create<GameChatState & GameChatActions>()(
  (set) => ({
    messages: [],
    whisperMessages: [],

    addMessage: (entry) =>
      set((s) => ({ messages: appendCapped(s.messages, entry) })),

    addWhisperMessage: (entry) =>
      set((s) => ({ whisperMessages: appendCapped(s.whisperMessages, entry) })),

    clear: () => set({ messages: [], whisperMessages: [] }),
  }),
);
