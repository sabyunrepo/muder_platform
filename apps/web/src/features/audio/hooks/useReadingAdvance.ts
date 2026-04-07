import { useCallback } from "react";
import { WsEventType } from "@mmp/shared";

import { useConnectionStore } from "@/stores/connectionStore";

// ---------------------------------------------------------------------------
// useReadingAdvance — Phase F3 C→S helper.
//
// Returns a stable callback that sends a `reading:advance` message on the game
// WS. Used by ReadingOverlay's onAdvance prop (F2). No-op if no game client is
// connected (e.g. before joining a session).
// ---------------------------------------------------------------------------

export function useReadingAdvance(): () => void {
  return useCallback(() => {
    const client = useConnectionStore.getState().gameClient;
    if (!client) return;
    try {
      client.send(WsEventType.READING_ADVANCE, {});
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn("[useReadingAdvance] failed to send reading:advance:", err);
      }
    }
  }, []);
}
