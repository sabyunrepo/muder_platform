/**
 * createVideoPlayer — factory that returns a concrete VideoPlayer for the
 * requested source type. Centralises the FILE vs YOUTUBE branching so call
 * sites stay agnostic of the underlying engine.
 */

import { FileVideoPlayer } from "./FileVideoPlayer";
import type { VideoPlayer } from "./VideoPlayer";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";

export function createVideoPlayer(
  sourceType: "FILE" | "YOUTUBE",
): VideoPlayer {
  if (sourceType === "YOUTUBE") return new YouTubeVideoPlayer();
  if (sourceType === "FILE") return new FileVideoPlayer();
  throw new Error(`createVideoPlayer: unknown sourceType: ${sourceType}`);
}
