import { useEffect, useRef } from "react";
import type { WsClient } from "@mmp/ws-client";

import { useConnectionStore } from "@/stores/connectionStore";
import { useSocialStore } from "@/stores/socialStore";
import { queryClient } from "@/services/queryClient";
import { socialKeys } from "../api";

// ---------------------------------------------------------------------------
// WS Event Payload Types
// ---------------------------------------------------------------------------

interface FriendOnlinePayload {
  user_id: string;
}

interface FriendOfflinePayload {
  user_id: string;
}

interface ChatMessagePayload {
  chat_room_id: string;
  sender_id: string;
}

interface ChatReadPayload {
  chat_room_id: string;
}

interface ChatTypingPayload {
  chat_room_id: string;
  user_ids: string[];
}

// ---------------------------------------------------------------------------
// Social WS Event Types (not yet in @mmp/shared WsEventType)
// ---------------------------------------------------------------------------

const SOCIAL_EVENT = {
  FRIEND_ONLINE: "friend:online",
  FRIEND_OFFLINE: "friend:offline",
  CHAT_MESSAGE: "chat:message",
  CHAT_READ: "chat:read",
  CHAT_TYPING: "chat:typing",
} as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Connects to the social WebSocket and syncs incoming events to:
 * - useSocialStore (online status, unread counts, typing indicators)
 * - React Query cache (message/room query invalidation)
 *
 * Should be mounted once at a high level (e.g., in the authenticated layout).
 */
export function useSocialSync(): void {
  const client = useConnectionStore((s) => s.socialClient);

  // Store actions via ref to avoid stale closures without re-subscribing
  const actionsRef = useRef(useSocialStore.getState());
  useEffect(() => {
    return useSocialStore.subscribe((state) => {
      actionsRef.current = state;
    });
  }, []);

  useEffect(() => {
    if (!client) return;

    const unsubs: (() => void)[] = [];

    const subscribe = <T>(
      wsClient: WsClient,
      event: string,
      handler: (payload: T) => void,
    ) => {
      const unsub = wsClient.on(event, (payload: unknown) => {
        handler(payload as T);
      });
      unsubs.push(unsub);
    };

    // friend:online → mark friend as online
    subscribe<FriendOnlinePayload>(
      client,
      SOCIAL_EVENT.FRIEND_ONLINE,
      (payload) => {
        actionsRef.current.setFriendOnline(payload.user_id);
      },
    );

    // friend:offline → mark friend as offline
    subscribe<FriendOfflinePayload>(
      client,
      SOCIAL_EVENT.FRIEND_OFFLINE,
      (payload) => {
        actionsRef.current.setFriendOffline(payload.user_id);
      },
    );

    // chat:message → invalidate messages query + increment unread
    subscribe<ChatMessagePayload>(
      client,
      SOCIAL_EVENT.CHAT_MESSAGE,
      (payload) => {
        queryClient.invalidateQueries({
          queryKey: socialKeys.messages(payload.chat_room_id),
        });
        queryClient.invalidateQueries({
          queryKey: socialKeys.chatRooms(),
        });
        actionsRef.current.incrementUnread(payload.chat_room_id);
      },
    );

    // chat:read → invalidate room queries
    subscribe<ChatReadPayload>(
      client,
      SOCIAL_EVENT.CHAT_READ,
      (payload) => {
        queryClient.invalidateQueries({
          queryKey: socialKeys.chatRoom(payload.chat_room_id),
        });
        queryClient.invalidateQueries({
          queryKey: socialKeys.chatRooms(),
        });
      },
    );

    // chat:typing → update typing indicator
    subscribe<ChatTypingPayload>(
      client,
      SOCIAL_EVENT.CHAT_TYPING,
      (payload) => {
        actionsRef.current.setTyping(
          payload.chat_room_id,
          payload.user_ids,
        );
      },
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [client]);
}
