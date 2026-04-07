/**
 * YouTubePlayer — wrapper around YouTube IFrame Player API.
 *
 * Used for:
 *  - Hidden BGM playback (long tracks streamed from YouTube to avoid R2 costs).
 *  - Visible cutscene/evidence video display (mounted to a host container).
 *
 * Lazy loads the IFrame API script on first instantiation, deduped across
 * multiple players.
 */

// ---------------------------------------------------------------------------
// Ambient YT typings (we avoid pulling @types/youtube)
// ---------------------------------------------------------------------------

interface YTPlayerEvent {
  target: YTPlayerInstance;
  data?: number;
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (v: number) => void;
  getCurrentTime: () => number;
  destroy: () => void;
}

interface YTPlayerOptions {
  width?: number | string;
  height?: number | string;
  videoId: string;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (e: YTPlayerEvent) => void;
    onStateChange?: (e: YTPlayerEvent) => void;
    onError?: (e: YTPlayerEvent) => void;
  };
}

interface YTNamespace {
  Player: new (
    el: HTMLElement | string,
    options: YTPlayerOptions,
  ) => YTPlayerInstance;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
  loaded?: number;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface YouTubeVideoOptions {
  videoId: string;
  hidden?: boolean;
  container?: HTMLElement;
  startSeconds?: number;
}

export interface YouTubePlayer {
  load(options: YouTubeVideoOptions): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setVolume(volume: number): void;
  onEnded(cb: () => void): () => void;
  onReady(cb: () => void): () => void;
  destroy(): void;
  getCurrentTime(): number;
}

// ---------------------------------------------------------------------------
// URL helper
// ---------------------------------------------------------------------------

export function extractYouTubeVideoId(url: string): string | null {
  if (typeof url !== "string" || url.length === 0) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lazy IFrame API loader (deduped)
// ---------------------------------------------------------------------------

let apiReadyPromise: Promise<void> | null = null;

function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTubePlayer requires a window"));
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise<void>((resolve) => {
    // If a previous load is in flight (script tag exists), just hook the global.
    const prevHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prevHandler?.();
      } catch {
        // ignore
      }
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]',
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }

    // Fast path: API already loaded synchronously (e.g. test mock).
    if (window.YT && window.YT.Player) {
      resolve();
    }
  });

  return apiReadyPromise;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createYouTubePlayer(): YouTubePlayer {
  let ytPlayer: YTPlayerInstance | null = null;
  let mountEl: HTMLElement | null = null;
  let ownsMount = false;
  const endedCbs = new Set<() => void>();
  const readyCbs = new Set<() => void>();
  let isReady = false;

  const handleStateChange = (event: YTPlayerEvent) => {
    const endedState = window.YT?.PlayerState?.ENDED ?? 0;
    if (event.data === endedState) {
      for (const cb of endedCbs) {
        try {
          cb();
        } catch {
          // ignore
        }
      }
    }
  };

  const handleReady = () => {
    isReady = true;
    for (const cb of readyCbs) {
      try {
        cb();
      } catch {
        // ignore
      }
    }
  };

  async function load(options: YouTubeVideoOptions): Promise<void> {
    if (!options.videoId) {
      throw new Error("YouTubePlayer.load: videoId is required");
    }
    const hidden = options.hidden ?? false;
    if (!hidden && !options.container) {
      throw new Error(
        "YouTubePlayer.load: container is required when hidden=false",
      );
    }

    await loadYouTubeIframeAPI();
    const YT = window.YT;
    if (!YT || !YT.Player) {
      throw new Error("YouTubePlayer: YT API failed to load");
    }

    // Tear down any prior player on this instance.
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch {
        // ignore
      }
      ytPlayer = null;
    }
    if (mountEl && ownsMount && mountEl.parentNode) {
      mountEl.parentNode.removeChild(mountEl);
    }
    mountEl = null;
    ownsMount = false;
    isReady = false;

    // Create mount element.
    const div = document.createElement("div");
    if (hidden) {
      div.style.width = "0";
      div.style.height = "0";
      div.style.display = "none";
      document.body.appendChild(div);
      ownsMount = true;
    } else {
      options.container!.appendChild(div);
      ownsMount = false;
    }
    mountEl = div;

    return new Promise<void>((resolve, reject) => {
      try {
        ytPlayer = new YT.Player(div, {
          width: hidden ? 0 : "100%",
          height: hidden ? 0 : "100%",
          videoId: options.videoId,
          playerVars: {
            autoplay: 0,
            controls: hidden ? 0 : 1,
            disablekb: hidden ? 1 : 0,
            modestbranding: 1,
            playsinline: 1,
            start: options.startSeconds ?? 0,
          },
          events: {
            onReady: () => {
              handleReady();
              resolve();
            },
            onStateChange: handleStateChange,
            onError: (e) => {
              // Surface as rejection only if we haven't resolved yet.
              if (!isReady) {
                reject(
                  new Error(
                    `YouTubePlayer: failed to load video (code=${e.data})`,
                  ),
                );
              }
            },
          },
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function play(): Promise<void> {
    if (!ytPlayer) throw new Error("YouTubePlayer.play: not loaded");
    ytPlayer.playVideo();
  }

  function pause(): void {
    ytPlayer?.pauseVideo();
  }

  function stop(): void {
    ytPlayer?.stopVideo();
  }

  function setVolume(volume: number): void {
    if (!ytPlayer) return;
    const clamped = Math.max(0, Math.min(1, volume));
    ytPlayer.setVolume(Math.round(clamped * 100));
  }

  function onEnded(cb: () => void): () => void {
    endedCbs.add(cb);
    return () => endedCbs.delete(cb);
  }

  function onReady(cb: () => void): () => void {
    readyCbs.add(cb);
    if (isReady) {
      // Fire async to keep semantics consistent.
      queueMicrotask(() => {
        if (readyCbs.has(cb)) cb();
      });
    }
    return () => readyCbs.delete(cb);
  }

  function destroy(): void {
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch {
        // ignore
      }
      ytPlayer = null;
    }
    if (mountEl && ownsMount && mountEl.parentNode) {
      mountEl.parentNode.removeChild(mountEl);
    }
    mountEl = null;
    ownsMount = false;
    endedCbs.clear();
    readyCbs.clear();
    isReady = false;
  }

  function getCurrentTime(): number {
    return ytPlayer?.getCurrentTime() ?? 0;
  }

  return {
    load,
    play,
    pause,
    stop,
    setVolume,
    onEnded,
    onReady,
    destroy,
    getCurrentTime,
  };
}

// Test-only helper to reset module-level lazy loader state.
export function __resetYouTubeApiLoaderForTests(): void {
  apiReadyPromise = null;
}
