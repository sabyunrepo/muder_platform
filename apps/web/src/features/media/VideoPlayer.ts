/**
 * VideoPlayer — abstraction over a video playback engine.
 *
 * Phase 7.7 ships only the YouTube implementation; file-based playback is
 * planned for Phase 7.8+. This interface lets UI code depend on the
 * abstraction without knowing which engine is in use.
 */

export interface VideoMedia {
  id: string;
  sourceType: "FILE" | "YOUTUBE";
  /** Required when sourceType === 'FILE' */
  url?: string;
  /** Required when sourceType === 'YOUTUBE' */
  videoId?: string;
  title?: string;
}

export interface VideoPlayer {
  /**
   * Load a media item. `attachTo` must be called before `load` so the
   * implementation knows which DOM container to mount the video into.
   */
  load(media: VideoMedia): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  /** Volume in 0..1 range. */
  setVolume(volume: number): void;
  /** Subscribe to ended events. Returns an unsubscribe function. */
  onEnded(cb: () => void): () => void;
  /** Subscribe to ready events. Returns an unsubscribe function. */
  onReady(cb: () => void): () => void;
  /** Set the host container for the video element/iframe. */
  attachTo(container: HTMLElement): void;
  /** Tear down all internal resources. Idempotent. */
  destroy(): void;
  /** Current playback position in seconds. Returns 0 if not loaded. */
  getCurrentTime(): number;
}
