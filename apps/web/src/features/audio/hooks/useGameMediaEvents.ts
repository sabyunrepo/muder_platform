import { useEffect } from "react";
import { WsEventType } from "@mmp/shared";

import { useWsEvent } from "@/hooks/useWsEvent";
import { useConnectionStore } from "@/stores/connectionStore";
import {
  useReadingStore,
  type ReadingLineWire,
  type ReadingStateSnapshot,
} from "@/stores/readingStore";
import { useAudioOrchestrator } from "../audioOrchestratorContext";
import type {
  PlayMediaPayload,
  PlayVoicePayload,
  SetBgmPayload,
} from "../AudioOrchestrator";

// ---------------------------------------------------------------------------
// useGameMediaEvents — Phase 7.7 audio + reading event router.
//
// Subscribes to S→C audio:* events on the game WS and dispatches them to the
// AudioOrchestrator created in AudioProvider. Also wires the orchestrator's
// reading-voice-ended callback to send a C→S `reading:voice_ended` message.
//
// Phase F3: also subscribes to reading:* events and updates the readingStore.
// IMPORTANT separation of concerns:
//   - Reading events update the reading store ONLY (UI state).
//   - Audio playback (BGM, voice) is driven by SEPARATE audio:set_bgm /
//     audio:play_voice events the server emits in lockstep with reading
//     transitions. The reading handlers here intentionally do NOT touch the
//     orchestrator — that keeps the audio pipeline driven by a single source
//     of truth and avoids needing to resolve mediaId → URL on the client.
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

  // -------------------------------------------------------------------------
  // Reading events (Phase F3) — update readingStore only.
  // -------------------------------------------------------------------------

  useWsEvent<{
    sectionId: string;
    lines: ReadingLineWire[];
    bgmMediaId?: string;
  }>("game", WsEventType.READING_STARTED, (payload) => {
    useReadingStore.getState().startSection(payload.sectionId, payload.lines);
  });

  useWsEvent<{ lineIndex: number }>(
    "game",
    WsEventType.READING_LINE_CHANGED,
    (payload) => {
      useReadingStore.getState().showLine(payload.lineIndex);
    },
  );

  useWsEvent<{ reason?: string }>(
    "game",
    WsEventType.READING_PAUSED,
    (payload) => {
      useReadingStore.getState().pauseSection(payload?.reason ?? "paused");
    },
  );

  useWsEvent<unknown>("game", WsEventType.READING_RESUMED, () => {
    useReadingStore.getState().resumeSection();
  });

  useWsEvent<unknown>("game", WsEventType.READING_COMPLETED, () => {
    useReadingStore.getState().completeSection();
  });

  useWsEvent<ReadingStateSnapshot>(
    "game",
    WsEventType.READING_STATE,
    (snapshot) => {
      useReadingStore.getState().restoreFromSnapshot(snapshot);
    },
  );

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
