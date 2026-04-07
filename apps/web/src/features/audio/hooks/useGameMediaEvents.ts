import { useEffect } from "react";
import { WsEventType } from "@mmp/shared";

import { useWsEvent } from "@/hooks/useWsEvent";
import { useConnectionStore } from "@/stores/connectionStore";
import { useAudioOrchestrator } from "../audioOrchestratorContext";
import type {
  PlayMediaPayload,
  PlayVoicePayload,
  SetBgmPayload,
} from "../AudioOrchestrator";

// ---------------------------------------------------------------------------
// useGameMediaEvents — Phase 7.7 audio event router.
//
// Subscribes to S→C audio:* events on the game WS and dispatches them to the
// AudioOrchestrator created in AudioProvider. Also wires the orchestrator's
// reading-voice-ended callback to send a C→S `reading:voice_ended` message.
//
// Reading-related events (reading:started / reading:line_changed / etc.) are
// handled by Phase F's reading hook — NOT here.
// ---------------------------------------------------------------------------

export function useGameMediaEvents(): void {
  const orchestrator = useAudioOrchestrator();

  useWsEvent<SetBgmPayload>("game", WsEventType.AUDIO_SET_BGM, (payload) => {
    if (!orchestrator) return;
    void orchestrator.handleSetBgm(payload);
  });

  useWsEvent<PlayVoicePayload>(
    "game",
    WsEventType.AUDIO_PLAY_VOICE,
    (payload) => {
      if (!orchestrator) return;
      orchestrator.handlePlayVoice(payload);
    },
  );

  useWsEvent<PlayMediaPayload>(
    "game",
    WsEventType.AUDIO_PLAY_MEDIA,
    (payload) => {
      if (!orchestrator) return;
      void orchestrator.handlePlayMedia(payload);
    },
  );

  useWsEvent<unknown>("game", WsEventType.AUDIO_STOP, () => {
    if (!orchestrator) return;
    orchestrator.handleStopAll();
  });

  // Wire VoiceManager onEnded → C→S reading:voice_ended.
  useEffect(() => {
    if (!orchestrator) return;

    const unsubscribe = orchestrator.setReadingVoiceEndedHandler((voiceId) => {
      const client = useConnectionStore.getState().gameClient;
      if (!client) return;
      try {
        client.send(WsEventType.READING_VOICE_ENDED, { voiceId });
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.warn(
            "[useGameMediaEvents] failed to send reading:voice_ended:",
            err,
          );
        }
      }
    });

    return unsubscribe;
  }, [orchestrator]);
}
