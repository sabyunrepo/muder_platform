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
  room_id: string;
  user_id: string;
}

// ---------------------------------------------------------------------------
// Social WS Event Types (not yet in @mmp/shared WsEventType)
// ---------------------------------------------------------------------------

const SOCIAL_EVENT = {
  FRIEND_ONLINE: "friend:online",
  FRIEND_OFFLINE: "friend:offline",
  FRIEND_REQUEST: "friend:request",
  FRIEND_ACCEPTED: "friend:accepted",
  CHAT_MESSAGE: "chat:message",
  CHAT_READ_RECEIPT: "chat:read_receipt",
  CHAT_TYPING_INDICATOR: "chat:typing_indicator",
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

    // chat:read_receipt → invalidate room queries
    subscribe<ChatReadPayload>(
      client,
      SOCIAL_EVENT.CHAT_READ_RECEIPT,
      (payload) => {
        queryClient.invalidateQueries({
          queryKey: socialKeys.chatRooms(),
        });
      },
    );

    // chat:typing_indicator → update typing indicator
    subscribe<ChatTypingPayload>(
      client,
      SOCIAL_EVENT.CHAT_TYPING_INDICATOR,
      (payload) => {
        actionsRef.current.setTyping(
          payload.room_id,
          [payload.user_id],
        );
        // Auto-clear typing after 3 seconds
        setTimeout(() => {
          actionsRef.current.setTyping(payload.room_id, []);
        }, 3000);
      },
    );

    // friend:request → invalidate pending requests
    subscribe<Record<string, unknown>>(
      client,
      SOCIAL_EVENT.FRIEND_REQUEST,
      () => {
        queryClient.invalidateQueries({
          queryKey: socialKeys.pending(),
        });
      },
    );

    // friend:accepted → invalidate friends list
    subscribe<Record<string, unknown>>(
      client,
      SOCIAL_EVENT.FRIEND_ACCEPTED,
      () => {
        queryClient.invalidateQueries({
          queryKey: socialKeys.friends(),
        });
      },
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [client]);
}
