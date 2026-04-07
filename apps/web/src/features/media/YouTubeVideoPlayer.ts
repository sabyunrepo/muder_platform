/**
 * YouTubeVideoPlayer — VideoPlayer implementation backed by the B5
 * YouTubePlayer (visible mode). Used for cutscenes and evidence videos.
 *
 * onEnded/onReady callbacks added before `load` are buffered locally and
 * forwarded once the underlying YT player exists. This avoids losing
 * subscriptions made during component mount, before media is selected.
 */

import {
  createYouTubePlayer,
  type YouTubePlayer,
} from "../audio/YouTubePlayer";
import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

export class YouTubeVideoPlayer implements VideoPlayer {
  private yt: YouTubePlayer | null = null;
  private container: HTMLElement | null = null;
  private currentMedia: VideoMedia | null = null;
  private endedListeners: (() => void)[] = [];
  private readyListeners: (() => void)[] = [];

  attachTo(container: HTMLElement): void {
    this.container = container;
  }

  async load(media: VideoMedia): Promise<void> {
    if (media.sourceType !== "YOUTUBE") {
      throw new Error("YouTubeVideoPlayer expects YOUTUBE source");
    }
    if (!media.videoId) {
      throw new Error("YouTubeVideoPlayer.load: videoId required");
    }
    if (!this.container) {
      throw new Error(
        "YouTubeVideoPlayer.load: attachTo must be called before load",
      );
    }

    // Tear down any prior player.
    if (this.yt) {
      this.yt.destroy();
      this.yt = null;
    }

    const yt = createYouTubePlayer();
    await yt.load({
      videoId: media.videoId,
      hidden: false,
      container: this.container,
    });
    this.yt = yt;
    this.currentMedia = media;

    // Flush buffered listeners onto the real player.
    for (const cb of this.endedListeners) yt.onEnded(cb);
    this.endedListeners = [];
    for (const cb of this.readyListeners) yt.onReady(cb);
    this.readyListeners = [];
  }

  async play(): Promise<void> {
    if (this.yt) await this.yt.play();
  }

  pause(): void {
    this.yt?.pause();
  }

  stop(): void {
    this.yt?.stop();
  }

  setVolume(volume: number): void {
    this.yt?.setVolume(volume);
  }

  onEnded(cb: () => void): () => void {
    if (this.yt) return this.yt.onEnded(cb);
    this.endedListeners.push(cb);
    return () => {
      this.endedListeners = this.endedListeners.filter((l) => l !== cb);
    };
  }

  onReady(cb: () => void): () => void {
    if (this.yt) return this.yt.onReady(cb);
    this.readyListeners.push(cb);
    return () => {
      this.readyListeners = this.readyListeners.filter((l) => l !== cb);
    };
  }

  getCurrentTime(): number {
    return this.yt?.getCurrentTime() ?? 0;
  }

  destroy(): void {
    if (this.yt) {
      this.yt.destroy();
      this.yt = null;
    }
    this.container = null;
    this.currentMedia = null;
    this.endedListeners = [];
    this.readyListeners = [];
  }
}
