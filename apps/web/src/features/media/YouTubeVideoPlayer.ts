/**
 * YouTubeVideoPlayer — VideoPlayer implementation backed by the B5
 * YouTubePlayer (visible mode). Used for cutscenes and evidence videos.
 *
 * onEnded/onReady callbacks added before `load` are buffered locally and
 * forwarded once the underlying YT player exists. Each subscription holds
 * a mutable { unsub } cell so the unsubscribe closure returned to callers
 * correctly targets the real YT unsubscribe after flushing.
 */

import {
  createYouTubePlayer,
  type YouTubePlayer,
} from "../audio/YouTubePlayer";
import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

interface Subscription {
  unsub: (() => void) | null;
}

interface SubEntry {
  cb: () => void;
  sub: Subscription;
}

export class YouTubeVideoPlayer implements VideoPlayer {
  private yt: YouTubePlayer | null = null;
  private container: HTMLElement | null = null;
  private currentMedia: VideoMedia | null = null;
  private endedSubs: SubEntry[] = [];
  private readySubs: SubEntry[] = [];

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

    // Tear down any prior player. Any existing subscriptions pointed at it
    // become stale — clear their unsub cells so they'll be re-attached to
    // the new player below.
    if (this.yt) {
      this.yt.destroy();
      this.yt = null;
      for (const entry of this.endedSubs) entry.sub.unsub = null;
      for (const entry of this.readySubs) entry.sub.unsub = null;
    }

    const yt = createYouTubePlayer();
    await yt.load({
      videoId: media.videoId,
      hidden: false,
      container: this.container,
    });
    this.yt = yt;
    this.currentMedia = media;

    // Flush buffered (or re-attach stale) listeners onto the real player.
    for (const entry of this.endedSubs) {
      if (!entry.sub.unsub) entry.sub.unsub = yt.onEnded(entry.cb);
    }
    for (const entry of this.readySubs) {
      if (!entry.sub.unsub) entry.sub.unsub = yt.onReady(entry.cb);
    }
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
    const sub: Subscription = { unsub: null };
    if (this.yt) sub.unsub = this.yt.onEnded(cb);
    const entry: SubEntry = { cb, sub };
    this.endedSubs.push(entry);
    return () => {
      sub.unsub?.();
      sub.unsub = null;
      this.endedSubs = this.endedSubs.filter((e) => e !== entry);
    };
  }

  onReady(cb: () => void): () => void {
    const sub: Subscription = { unsub: null };
    if (this.yt) sub.unsub = this.yt.onReady(cb);
    const entry: SubEntry = { cb, sub };
    this.readySubs.push(entry);
    return () => {
      sub.unsub?.();
      sub.unsub = null;
      this.readySubs = this.readySubs.filter((e) => e !== entry);
    };
  }

  getCurrentTime(): number {
    return this.yt?.getCurrentTime() ?? 0;
  }

  destroy(): void {
    // Release any live YT unsubs before tearing down.
    for (const entry of this.endedSubs) {
      entry.sub.unsub?.();
      entry.sub.unsub = null;
    }
    for (const entry of this.readySubs) {
      entry.sub.unsub?.();
      entry.sub.unsub = null;
    }
    if (this.yt) {
      this.yt.destroy();
      this.yt = null;
    }
    this.container = null;
    this.currentMedia = null;
    this.endedSubs = [];
    this.readySubs = [];
  }
}
