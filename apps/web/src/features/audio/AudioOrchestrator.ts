import type { AudioGraph, AudioChannel } from "./audioGraph";
import type { BgmManager } from "./BgmManager";
import type { VoiceManager } from "./VoiceManager";
import { createYouTubePlayer, type YouTubePlayer } from "./YouTubePlayer";

// ---------------------------------------------------------------------------
// AudioOrchestrator — composes BgmManager, VoiceManager, YouTubePlayer
//
// Responsibilities:
//  - Routes WS audio events to the right manager
//  - Maintains a single "active BGM" slot that can be FILE (BgmManager) OR
//    YOUTUBE (hidden YouTubePlayer); tears down on switch
//  - Implements cutscene bgmBehavior coordination (pause/keep/stop) for the
//    VideoOrchestrator (Phase C) to call into
//  - Bridges BGM mediaId changes to the audioStore for reconnect restore
//  - Forwards channel volume updates to the audioGraph
// ---------------------------------------------------------------------------

export interface SetBgmPayload {
  mediaId: string;
  sourceType: "FILE" | "YOUTUBE";
  url?: string; // for FILE
  videoId?: string; // for YOUTUBE
  fadeMs?: number;
}

export interface PlayVoicePayload {
  mediaId: string;
  url: string;
}

export interface PlayMediaPayload {
  mediaId: string;
  url?: string;
  mode?: "cutscene" | "inline";
}

export type BgmBehavior = "pause" | "keep" | "stop";

export interface AudioOrchestratorOptions {
  graph: AudioGraph;
  bgmManager: BgmManager;
  voiceManager: VoiceManager;
  audioManager?: { playSound(url: string): Promise<void> };
  onBgmMediaIdChange?: (id: string | null) => void;
  // Test seam: override the YouTubePlayer factory.
  createYouTubePlayer?: () => YouTubePlayer;
}

export interface AudioOrchestrator {
  handleSetBgm(payload: SetBgmPayload): Promise<void>;
  handlePlayVoice(payload: PlayVoicePayload): void;
  handlePlayMedia(payload: PlayMediaPayload): Promise<void>;
  handleStopAll(): void;
  handleCutsceneStart(behavior: BgmBehavior): void;
  handleCutsceneEnd(): void;
  setChannelVolume(channel: AudioChannel, volume: number): void;
  setReadingVoiceEndedHandler(cb: (voiceId: string) => void): () => void;
  dispose(): void;
}

export function createAudioOrchestrator(
  opts: AudioOrchestratorOptions,
): AudioOrchestrator {
  const {
    graph,
    bgmManager,
    voiceManager,
    audioManager,
    onBgmMediaIdChange,
  } = opts;
  const ytFactory = opts.createYouTubePlayer ?? createYouTubePlayer;

  let activeBgmKind: "file" | "youtube" | null = null;
  let activeBgmMediaId: string | null = null;
  let activeYouTubePlayer: YouTubePlayer | null = null;
  let lastCutsceneBehavior: BgmBehavior | null = null;
  let cutsceneBgmKindAtStart: "file" | "youtube" | null = null;
  let disposed = false;

  function notifyBgmId(id: string | null): void {
    activeBgmMediaId = id;
    try {
      onBgmMediaIdChange?.(id);
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn("[AudioOrchestrator] onBgmMediaIdChange threw:", err);
      }
    }
  }

  function destroyYouTube(): void {
    if (activeYouTubePlayer) {
      try {
        activeYouTubePlayer.destroy();
      } catch {
        // ignore
      }
      activeYouTubePlayer = null;
    }
  }

  async function handleSetBgm(payload: SetBgmPayload): Promise<void> {
    if (disposed) return;

    // Idempotent: same mediaId — skip.
    if (activeBgmMediaId === payload.mediaId) return;

    if (payload.sourceType === "FILE") {
      if (!payload.url) {
        if (import.meta.env?.DEV) {
          console.warn(
            "[AudioOrchestrator] FILE bgm payload missing url",
            payload,
          );
        }
        return;
      }
      // Tear down YouTube if previously active.
      if (activeBgmKind === "youtube") {
        destroyYouTube();
      }
      await bgmManager.play({ id: payload.mediaId, url: payload.url });
      activeBgmKind = "file";
      notifyBgmId(payload.mediaId);
      return;
    }

    if (payload.sourceType === "YOUTUBE") {
      if (!payload.videoId) {
        if (import.meta.env?.DEV) {
          console.warn(
            "[AudioOrchestrator] YOUTUBE bgm payload missing videoId",
            payload,
          );
        }
        return;
      }
      // Tear down whichever was previously active.
      if (activeBgmKind === "file") {
        await bgmManager.stop(payload.fadeMs);
      } else if (activeBgmKind === "youtube") {
        destroyYouTube();
      }
      const player = ytFactory();
      activeYouTubePlayer = player;
      try {
        await player.load({ videoId: payload.videoId, hidden: true });
        await player.play();
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.warn("[AudioOrchestrator] YouTube BGM load failed:", err);
        }
        destroyYouTube();
        activeBgmKind = null;
        notifyBgmId(null);
        return;
      }
      activeBgmKind = "youtube";
      notifyBgmId(payload.mediaId);
    }
  }

  function handlePlayVoice(payload: PlayVoicePayload): void {
    if (disposed) return;
    voiceManager.enqueue({ id: payload.mediaId, url: payload.url });
  }

  async function handlePlayMedia(payload: PlayMediaPayload): Promise<void> {
    if (disposed) return;
    // SFX path — delegate to AudioManager when available.
    if (audioManager && payload.url) {
      try {
        await audioManager.playSound(payload.url);
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.warn("[AudioOrchestrator] playSound failed:", err);
        }
      }
    }
  }

  function handleStopAll(): void {
    if (disposed) return;
    voiceManager.stopAll();
    if (activeBgmKind === "file") {
      void bgmManager.stop();
    } else if (activeBgmKind === "youtube") {
      destroyYouTube();
    }
    activeBgmKind = null;
    notifyBgmId(null);
  }

  function handleCutsceneStart(behavior: BgmBehavior): void {
    if (disposed) return;
    lastCutsceneBehavior = behavior;
    cutsceneBgmKindAtStart = activeBgmKind;

    if (behavior === "keep") return;

    if (behavior === "pause") {
      if (activeBgmKind === "file") {
        bgmManager.pause();
      } else if (activeBgmKind === "youtube" && activeYouTubePlayer) {
        try {
          activeYouTubePlayer.pause();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (behavior === "stop") {
      if (activeBgmKind === "file") {
        void bgmManager.stop();
      } else if (activeBgmKind === "youtube") {
        destroyYouTube();
      }
      activeBgmKind = null;
      notifyBgmId(null);
    }
  }

  function handleCutsceneEnd(): void {
    if (disposed) return;
    const behavior = lastCutsceneBehavior;
    const prevKind = cutsceneBgmKindAtStart;
    lastCutsceneBehavior = null;
    cutsceneBgmKindAtStart = null;

    if (behavior !== "pause") return;

    if (prevKind === "file") {
      bgmManager.resume();
    } else if (prevKind === "youtube" && activeYouTubePlayer) {
      void activeYouTubePlayer.play().catch(() => {
        // ignore
      });
    }
  }

  function setChannelVolume(channel: AudioChannel, volume: number): void {
    graph.setChannelVolume(channel, volume);
  }

  function setReadingVoiceEndedHandler(
    cb: (voiceId: string) => void,
  ): () => void {
    return voiceManager.onEnded(cb);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    destroyYouTube();
    try {
      bgmManager.dispose();
    } catch {
      // ignore
    }
    try {
      voiceManager.dispose();
    } catch {
      // ignore
    }
    activeBgmKind = null;
    activeBgmMediaId = null;
    lastCutsceneBehavior = null;
    cutsceneBgmKindAtStart = null;
  }

  return {
    handleSetBgm,
    handlePlayVoice,
    handlePlayMedia,
    handleStopAll,
    handleCutsceneStart,
    handleCutsceneEnd,
    setChannelVolume,
    setReadingVoiceEndedHandler,
    dispose,
  };
}
