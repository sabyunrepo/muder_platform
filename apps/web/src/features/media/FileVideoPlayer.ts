/**
 * FileVideoPlayer — placeholder for file-based (HTML5 <video>) playback.
 *
 * Not implemented in Phase 7.7. Constructing this class throws so that any
 * accidental call sites surface immediately. Real implementation is planned
 * for Phase 7.8+ when R2-hosted MP4 cutscenes are introduced.
 */

import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

export class FileVideoPlayer implements VideoPlayer {
  constructor() {
    throw new Error(
      "FileVideoPlayer is not implemented in Phase 7.7 (YouTube only). File-based video support is planned for Phase 7.8+.",
    );
  }

  // The methods below are unreachable because the constructor throws, but
  // they exist to satisfy the VideoPlayer interface contract.
  /* c8 ignore start */
  async load(_media: VideoMedia): Promise<void> {
    throw new Error("unreachable");
  }
  async play(): Promise<void> {
    throw new Error("unreachable");
  }
  pause(): void {}
  stop(): void {}
  setVolume(_volume: number): void {}
  onEnded(_cb: () => void): () => void {
    return () => {};
  }
  onReady(_cb: () => void): () => void {
    return () => {};
  }
  attachTo(_container: HTMLElement): void {}
  destroy(): void {}
  getCurrentTime(): number {
    return 0;
  }
  /* c8 ignore stop */
}
