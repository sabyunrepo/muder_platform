import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SocialState {
  /** User IDs of friends currently online */
  onlineFriends: Set<string>;
  /** roomId → unread message count */
  unreadCounts: Map<string, number>;
  /** roomId → list of user IDs currently typing */
  typingUsers: Map<string, string[]>;
}

export interface SocialActions {
  setFriendOnline: (userId: string) => void;
  setFriendOffline: (userId: string) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  incrementUnread: (roomId: string) => void;
  clearUnread: (roomId: string) => void;
  setTyping: (roomId: string, userIds: string[]) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState: SocialState = {
  onlineFriends: new Set<string>(),
  unreadCounts: new Map<string, number>(),
  typingUsers: new Map<string, string[]>(),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSocialStore = create<SocialState & SocialActions>()(
  (set) => ({
    ...initialState,

    setFriendOnline: (userId) => {
      set((state) => {
        const next = new Set(state.onlineFriends);
        next.add(userId);
        return { onlineFriends: next };
      });
    },

    setFriendOffline: (userId) => {
      set((state) => {
        const next = new Set(state.onlineFriends);
        next.delete(userId);
        return { onlineFriends: next };
      });
    },

    setUnreadCount: (roomId, count) => {
      set((state) => {
        const next = new Map(state.unreadCounts);
        next.set(roomId, count);
        return { unreadCounts: next };
      });
    },

    incrementUnread: (roomId) => {
      set((state) => {
        const next = new Map(state.unreadCounts);
        next.set(roomId, (next.get(roomId) ?? 0) + 1);
        return { unreadCounts: next };
      });
    },

    clearUnread: (roomId) => {
      set((state) => {
        const next = new Map(state.unreadCounts);
        next.delete(roomId);
        return { unreadCounts: next };
      });
    },

    setTyping: (roomId, userIds) => {
      set((state) => {
        const next = new Map(state.typingUsers);
        if (userIds.length === 0) {
          next.delete(roomId);
        } else {
          next.set(roomId, userIds);
        }
        return { typingUsers: next };
      });
    },

    reset: () => {
      set({
        onlineFriends: new Set<string>(),
        unreadCounts: new Map<string, number>(),
        typingUsers: new Map<string, string[]>(),
      });
    },
  }),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectOnlineFriends = (s: SocialState) => s.onlineFriends;
export const selectUnreadCounts = (s: SocialState) => s.unreadCounts;
export const selectTypingUsers = (s: SocialState) => s.typingUsers;

export const selectIsFriendOnline = (userId: string) => (s: SocialState) =>
  s.onlineFriends.has(userId);

export const selectUnreadCount = (roomId: string) => (s: SocialState) =>
  s.unreadCounts.get(roomId) ?? 0;

export const selectRoomTypingUsers = (roomId: string) => (s: SocialState) =>
  s.typingUsers.get(roomId) ?? [];

export const selectTotalUnread = (s: SocialState) => {
  let total = 0;
  for (const count of s.unreadCounts.values()) {
    total += count;
  }
  return total;
};
