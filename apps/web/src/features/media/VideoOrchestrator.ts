/**
 * VideoOrchestrator — singleton lifecycle manager for cutscene video playback.
 *
 * Owns at most one active cutscene VideoPlayer. Coordinates with the
 * AudioOrchestrator so BGM is paused/kept/stopped appropriately while a
 * cutscene plays. Evidence videos use independent VideoPlayer instances and
 * are NOT managed here.
 */

import { createVideoPlayer as defaultCreateVideoPlayer } from "./createVideoPlayer";
import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

export type BgmBehavior = "pause" | "keep" | "stop";

export interface PlayCutsceneOptions {
  media: VideoMedia;
  bgmBehavior: BgmBehavior;
  skippable: boolean;
  container: HTMLElement;
  onEnded?: () => void;
}

export interface VideoOrchestratorOptions {
  audioOrchestrator: {
    handleCutsceneStart(behavior: BgmBehavior): void;
    handleCutsceneEnd(): void;
  };
  createVideoPlayerFn?: (sourceType: "FILE" | "YOUTUBE") => VideoPlayer;
  onVideoEnded?: (mediaId: string) => void;
}

export interface VideoOrchestrator {
  playCutscene(opts: PlayCutsceneOptions): Promise<void>;
  skipCutscene(): void;
  isPlaying(): boolean;
  getCurrentMediaId(): string | null;
  dispose(): void;
}

export function createVideoOrchestrator(
  opts: VideoOrchestratorOptions,
): VideoOrchestrator {
  const createPlayer = opts.createVideoPlayerFn ?? defaultCreateVideoPlayer;

  let currentPlayer: VideoPlayer | null = null;
  let currentMediaId: string | null = null;
  let currentSkippable = false;
  let localEndedCb: (() => void) | undefined;
  let endedHandled = false;

  function handleVideoEnded(): void {
    if (endedHandled) return;
    endedHandled = true;

    const mediaId = currentMediaId;
    const cb = localEndedCb;
    const player = currentPlayer;

    // Resume BGM (if behavior was 'pause') before clearing state.
    try {
      opts.audioOrchestrator.handleCutsceneEnd();
    } catch (err) {
      console.warn("[VideoOrchestrator] audio.handleCutsceneEnd threw", err);
    }

    if (mediaId && opts.onVideoEnded) {
      try {
        opts.onVideoEnded(mediaId);
      } catch (err) {
        console.warn("[VideoOrchestrator] onVideoEnded threw", err);
      }
    }

    if (cb) {
      try {
        cb();
      } catch (err) {
        console.warn("[VideoOrchestrator] localEndedCb threw", err);
      }
    }

    if (player) {
      try {
        player.destroy();
      } catch (err) {
        console.warn("[VideoOrchestrator] player.destroy threw", err);
      }
    }

    currentPlayer = null;
    currentMediaId = null;
    currentSkippable = false;
    localEndedCb = undefined;
  }

  async function playCutscene(playOpts: PlayCutsceneOptions): Promise<void> {
    if (currentPlayer) {
      console.warn(
        "[VideoOrchestrator] cutscene already playing; ignoring playCutscene",
        { current: currentMediaId, requested: playOpts.media.id },
      );
      return;
    }

    // Notify audio first so BGM transitions before video starts.
    opts.audioOrchestrator.handleCutsceneStart(playOpts.bgmBehavior);

    // Factory may throw synchronously (e.g. FileVideoPlayer not yet
    // implemented). Let it propagate after we've reset state so the
    // orchestrator stays usable.
    let player: VideoPlayer;
    try {
      player = createPlayer(playOpts.media.sourceType);
    } catch (err) {
      // Roll back audio state since we never started playback.
      try {
        opts.audioOrchestrator.handleCutsceneEnd();
      } catch {
        /* ignore */
      }
      throw err;
    }

    currentPlayer = player;
    currentMediaId = playOpts.media.id;
    currentSkippable = playOpts.skippable;
    localEndedCb = playOpts.onEnded;
    endedHandled = false;

    player.attachTo(playOpts.container);
    player.onEnded(() => handleVideoEnded());

    try {
      await player.load(playOpts.media);
      await player.play();
    } catch (err) {
      // Clean up so future cutscenes can be played.
      try {
        opts.audioOrchestrator.handleCutsceneEnd();
      } catch {
        /* ignore */
      }
      try {
        player.destroy();
      } catch {
        /* ignore */
      }
      currentPlayer = null;
      currentMediaId = null;
      currentSkippable = false;
      localEndedCb = undefined;
      throw err;
    }
  }

  function skipCutscene(): void {
    if (!currentPlayer) return;
    handleVideoEnded();
  }

  function isPlaying(): boolean {
    return currentPlayer !== null;
  }

  function getCurrentMediaId(): string | null {
    return currentMediaId;
  }

  function dispose(): void {
    if (currentPlayer) {
      skipCutscene();
    }
    currentPlayer = null;
    currentMediaId = null;
    currentSkippable = false;
    localEndedCb = undefined;
  }

  // Reference currentSkippable to satisfy noUnusedLocals; reserved for
  // skip-button gating in CutsceneModal (C3).
  void currentSkippable;

  return {
    playCutscene,
    skipCutscene,
    isPlaying,
    getCurrentMediaId,
    dispose,
  };
}
