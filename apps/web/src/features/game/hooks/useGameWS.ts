import { useCallback } from "react";
import type { WsClient } from "@mmp/ws-client";
import { WsClientState } from "@mmp/ws-client";
import type { WsEventType } from "@mmp/shared";

import { useAuthStore, selectAccessToken } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useWsClient } from "@/hooks/useWsClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseGameWSReturn {
  client: WsClient | null;
  state: WsClientState;
  isConnected: boolean;
  isReconnecting: boolean;
  send: <T>(type: WsEventType, payload: T) => void;
  connect: () => void;
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the game WebSocket connection for a session.
 * Wraps useWsClient with game-specific defaults:
 * - exponential backoff reconnect (1s, 2s, 4s, 8s … max 30s) via WsClient
 * - token via query param `?token=` (not Authorization header)
 *
 * @param sessionId - The game session ID to connect to.
 */
export function useGameWS(sessionId: string | null): UseGameWSReturn {
  const { client, state, send, connect, disconnect } = useWsClient({
    endpoint: "game",
    sessionId: sessionId ?? undefined,
    autoConnect: !!sessionId,
  });

  return {
    client,
    state,
    isConnected: state === WsClientState.CONNECTED,
    isReconnecting: state === WsClientState.RECONNECTING,
    send,
    connect,
    disconnect,
  };
}

// ---------------------------------------------------------------------------
// Utility: manual game connect with custom reconnect options
// ---------------------------------------------------------------------------

/**
 * Returns a stable `connectGame` function that respects the current token.
 * Useful in cases where the caller needs to initiate the connection imperatively.
 */
export function useConnectGame(): (sessionId: string) => void {
  const accessToken = useAuthStore(selectAccessToken);
  const connectGame = useConnectionStore((s) => s.connectGame);

  return useCallback(
    (sessionId: string) => {
      if (!accessToken) return;
      connectGame(sessionId, accessToken);
    },
    [accessToken, connectGame],
  );
}
