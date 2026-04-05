import { useEffect, useRef } from "react";
import type { WsEventType } from "@mmp/shared";

import { useConnectionStore } from "@/stores/connectionStore";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 특정 WS 이벤트를 구독하는 hook.
 * handler를 useRef로 래핑하여 stale closure를 방지하고,
 * 콜백이 바뀌어도 재구독하지 않는다.
 * client 인스턴스가 변경되면 자동으로 재구독한다.
 */
export function useWsEvent<T = unknown>(
  endpoint: "game" | "social",
  eventType: WsEventType,
  handler: (payload: T, seq: number) => void,
): void {
  // handler를 ref로 래핑 — 항상 최신 콜백 참조
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const client = useConnectionStore((s) =>
    endpoint === "game" ? s.gameClient : s.socialClient,
  );

  useEffect(() => {
    if (!client) return;

    // 안정적인 래퍼 — ref를 통해 최신 handler 호출
    const stableHandler = (payload: unknown, seq: number): void => {
      handlerRef.current(payload as T, seq);
    };

    const unsubscribe = client.on(eventType, stableHandler);

    return unsubscribe;
  }, [client, eventType]);
}
