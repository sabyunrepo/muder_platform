import { useCallback, useEffect, useRef } from "react";
import type { WsClient } from "@mmp/ws-client";
import { WsClientState } from "@mmp/ws-client";
import type { WsEventType } from "@mmp/shared";

import { useAuthStore, selectAccessToken } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseWsClientOptions {
  endpoint: "game" | "social";
  /** game 엔드포인트일 때 필수 */
  sessionId?: string;
  /** mount 시 자동 연결 여부 (기본값: true) */
  autoConnect?: boolean;
}

interface UseWsClientReturn {
  client: WsClient | null;
  state: WsClientState;
  send: <T>(type: WsEventType, payload: T) => void;
  connect: () => void;
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * WsClient 라이프사이클 hook.
 * connectionStore와 연동하여 WebSocket 연결/해제를 관리한다.
 */
export function useWsClient(options: UseWsClientOptions): UseWsClientReturn {
  const { endpoint, sessionId, autoConnect = true } = options;

  const accessToken = useAuthStore(selectAccessToken);

  // connectionStore에서 endpoint에 맞는 값 구독
  const client = useConnectionStore((s) =>
    endpoint === "game" ? s.gameClient : s.socialClient,
  );
  const state = useConnectionStore((s) =>
    endpoint === "game" ? s.gameState : s.socialState,
  );

  const connectGame = useConnectionStore((s) => s.connectGame);
  const connectSocial = useConnectionStore((s) => s.connectSocial);
  const disconnectGame = useConnectionStore((s) => s.disconnectGame);
  const disconnectSocial = useConnectionStore((s) => s.disconnectSocial);

  // 최신 옵션을 ref로 유지 (effect 의존성 최소화)
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  // ------ connect / disconnect 안정 콜백 ------

  const connect = useCallback(() => {
    const token = tokenRef.current;
    if (!token) return;

    if (endpoint === "game") {
      const sid = optionsRef.current.sessionId;
      if (!sid) {
        if (import.meta.env.DEV) {
          console.warn("[useWsClient] game 엔드포인트에 sessionId가 필요합니다.");
        }
        return;
      }
      connectGame(sid, token);
    } else {
      connectSocial(token);
    }
  }, [endpoint, connectGame, connectSocial]);

  const disconnect = useCallback(() => {
    if (endpoint === "game") {
      disconnectGame();
    } else {
      disconnectSocial();
    }
  }, [endpoint, disconnectGame, disconnectSocial]);

  // ------ send 래핑 ------

  const send = useCallback(
    <T,>(type: WsEventType, payload: T): void => {
      if (!client) {
        if (import.meta.env.DEV) {
          console.warn("[useWsClient] client가 null입니다. send를 무시합니다.");
        }
        return;
      }
      client.send(type, payload);
    },
    [client],
  );

  // ------ 자동 연결 / 해제 ------

  useEffect(() => {
    if (!autoConnect) return;
    if (!accessToken) return;

    // game 엔드포인트는 sessionId가 있어야 연결
    if (endpoint === "game" && !sessionId) return;

    connect();

    return () => {
      disconnect();
    };
  }, [autoConnect, accessToken, endpoint, sessionId, connect, disconnect]);

  return { client, state, send, connect, disconnect };
}
