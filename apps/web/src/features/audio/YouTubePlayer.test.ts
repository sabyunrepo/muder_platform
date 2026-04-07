import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createYouTubePlayer,
  extractYouTubeVideoId,
  __resetYouTubeApiLoaderForTests,
} from "./YouTubePlayer";

// ---------------------------------------------------------------------------
// Mock YT.Player
// ---------------------------------------------------------------------------

const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

interface MockEvents {
  onReady?: (e: { target: MockYTPlayer }) => void;
  onStateChange?: (e: { data: number; target: MockYTPlayer }) => void;
  onError?: (e: { data: number; target: MockYTPlayer }) => void;
}

const allPlayers: MockYTPlayer[] = [];

class MockYTPlayer {
  events: MockEvents;
  el: HTMLElement | string;
  opts: Record<string, unknown>;
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  stopVideo = vi.fn();
  setVolume = vi.fn();
  getCurrentTime = vi.fn(() => 12.5);
  destroy = vi.fn();

  constructor(el: HTMLElement | string, opts: Record<string, unknown>) {
    this.el = el;
    this.opts = opts;
    this.events = (opts.events as MockEvents) || {};
    allPlayers.push(this);
    // Fire ready async to mimic real behavior.
    setTimeout(() => {
      this.events.onReady?.({ target: this });
    }, 0);
  }

  fireStateChange(state: number) {
    this.events.onStateChange?.({ data: state, target: this });
  }

  fireError(code: number) {
    this.events.onError?.({ data: code, target: this });
  }
}

function lastPlayer(): MockYTPlayer {
  return allPlayers[allPlayers.length - 1];
}

beforeEach(() => {
  allPlayers.length = 0;
  delete (window as unknown as { YT?: unknown }).YT;
  delete (window as unknown as { onYouTubeIframeAPIReady?: unknown })
    .onYouTubeIframeAPIReady;
  document.head
    .querySelectorAll('script[src*="youtube.com"]')
    .forEach((s) => s.remove());
  document.body.innerHTML = "";
  __resetYouTubeApiLoaderForTests();

  // Provide YT globally so loadYouTubeIframeAPI fast-paths immediately.
  (window as unknown as { YT: unknown }).YT = {
    Player: MockYTPlayer,
    PlayerState: YT_PLAYER_STATE,
    loaded: 1,
  };
});

// ---------------------------------------------------------------------------
// extractYouTubeVideoId
// ---------------------------------------------------------------------------

describe("extractYouTubeVideoId", () => {
  it("extracts from youtube.com/watch?v=...", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtu.be/...", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts from youtube.com/embed/...", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for invalid URL", () => {
    expect(extractYouTubeVideoId("not a url")).toBe(null);
  });

  it("returns null for empty input", () => {
    expect(extractYouTubeVideoId("")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// YouTubePlayer
// ---------------------------------------------------------------------------

describe("YouTubePlayer", () => {
  it("load resolves when onReady fires", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    expect(allPlayers.length).toBe(1);
    expect(lastPlayer().opts.videoId).toBe("abc");
  });

  it("hidden=true mounts an invisible div on document.body", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    const mount = lastPlayer().el as HTMLElement;
    expect(mount.style.display).toBe("none");
    expect(mount.style.width).toBe("0px");
    expect(mount.parentNode).toBe(document.body);
  });

  it("hidden=false attaches to provided container", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: false, container });
    const mount = lastPlayer().el as HTMLElement;
    expect(mount.parentNode).toBe(container);
  });

  it("hidden=false without container throws", async () => {
    const player = createYouTubePlayer();
    await expect(player.load({ videoId: "abc", hidden: false })).rejects.toThrow(
      /container is required/,
    );
  });

  it("missing videoId throws", async () => {
    const player = createYouTubePlayer();
    await expect(
      player.load({ videoId: "", hidden: true }),
    ).rejects.toThrow(/videoId is required/);
  });

  it("play calls playVideo on the underlying player", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    await player.play();
    expect(lastPlayer().playVideo).toHaveBeenCalledTimes(1);
  });

  it("pause calls pauseVideo", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    player.pause();
    expect(lastPlayer().pauseVideo).toHaveBeenCalledTimes(1);
  });

  it("stop calls stopVideo", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    player.stop();
    expect(lastPlayer().stopVideo).toHaveBeenCalledTimes(1);
  });

  it("setVolume converts 0..1 to 0..100", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    player.setVolume(0.5);
    expect(lastPlayer().setVolume).toHaveBeenCalledWith(50);
    player.setVolume(0);
    expect(lastPlayer().setVolume).toHaveBeenCalledWith(0);
    player.setVolume(1);
    expect(lastPlayer().setVolume).toHaveBeenCalledWith(100);
  });

  it("setVolume clamps out-of-range values", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    player.setVolume(-1);
    expect(lastPlayer().setVolume).toHaveBeenCalledWith(0);
    player.setVolume(2);
    expect(lastPlayer().setVolume).toHaveBeenCalledWith(100);
  });

  it("onEnded fires when state becomes ENDED", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    const cb = vi.fn();
    player.onEnded(cb);
    lastPlayer().fireStateChange(YT_PLAYER_STATE.PLAYING);
    expect(cb).not.toHaveBeenCalled();
    lastPlayer().fireStateChange(YT_PLAYER_STATE.ENDED);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("onEnded returns unsubscribe", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    const cb = vi.fn();
    const off = player.onEnded(cb);
    off();
    lastPlayer().fireStateChange(YT_PLAYER_STATE.ENDED);
    expect(cb).not.toHaveBeenCalled();
  });

  it("getCurrentTime delegates to underlying player", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    expect(player.getCurrentTime()).toBe(12.5);
  });

  it("destroy calls underlying destroy and clears state", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    const mock = lastPlayer();
    player.destroy();
    expect(mock.destroy).toHaveBeenCalledTimes(1);
    // After destroy, getCurrentTime returns 0 (no underlying player).
    expect(player.getCurrentTime()).toBe(0);
  });

  it("loading twice tears down the previous player", async () => {
    const player = createYouTubePlayer();
    await player.load({ videoId: "abc", hidden: true });
    const first = lastPlayer();
    await player.load({ videoId: "xyz", hidden: true });
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(allPlayers.length).toBe(2);
    expect(lastPlayer().opts.videoId).toBe("xyz");
  });
});
