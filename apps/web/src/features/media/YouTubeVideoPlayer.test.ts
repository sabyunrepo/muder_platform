import { beforeEach, describe, expect, it, vi } from "vitest";

import { createYouTubePlayer } from "../audio/YouTubePlayer";
import type { VideoMedia } from "./VideoPlayer";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";

vi.mock("../audio/YouTubePlayer", () => ({
  createYouTubePlayer: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    onEnded: vi.fn().mockReturnValue(() => {}),
    onReady: vi.fn().mockReturnValue(() => {}),
    getCurrentTime: vi.fn().mockReturnValue(0),
    destroy: vi.fn(),
  })),
  extractYouTubeVideoId: vi.fn(),
}));

const mockedCreate = vi.mocked(createYouTubePlayer);

const ytMedia: VideoMedia = {
  id: "m1",
  sourceType: "YOUTUBE",
  videoId: "abcDEF12345",
  title: "Test",
};

function makeContainer(): HTMLElement {
  return document.createElement("div");
}

beforeEach(() => {
  mockedCreate.mockClear();
});

describe("YouTubeVideoPlayer", () => {
  it("throws when load is called before attachTo", async () => {
    const player = new YouTubeVideoPlayer();
    await expect(player.load(ytMedia)).rejects.toThrow(/attachTo/);
  });

  it("throws when load is called with non-YOUTUBE media", async () => {
    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());
    await expect(
      player.load({ id: "x", sourceType: "FILE", url: "/v.mp4" }),
    ).rejects.toThrow(/YOUTUBE/);
  });

  it("throws when YOUTUBE media is missing videoId", async () => {
    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());
    await expect(
      player.load({ id: "x", sourceType: "YOUTUBE" }),
    ).rejects.toThrow(/videoId/);
  });

  it("creates a YT player with the container on successful load", async () => {
    const player = new YouTubeVideoPlayer();
    const container = makeContainer();
    player.attachTo(container);

    await player.load(ytMedia);

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    const ytInstance = mockedCreate.mock.results[0].value;
    expect(ytInstance.load).toHaveBeenCalledWith({
      videoId: "abcDEF12345",
      hidden: false,
      container,
    });
  });

  it("buffers onEnded subscriptions made before load and flushes on load", async () => {
    const player = new YouTubeVideoPlayer();
    const container = makeContainer();
    player.attachTo(container);

    const cb = vi.fn();
    const unsubscribe = player.onEnded(cb);
    expect(typeof unsubscribe).toBe("function");

    // Not yet loaded → underlying player should not exist.
    expect(mockedCreate).not.toHaveBeenCalled();

    await player.load(ytMedia);

    const ytInstance = mockedCreate.mock.results[0].value;
    expect(ytInstance.onEnded).toHaveBeenCalledWith(cb);
  });

  it("buffers onReady subscriptions before load and flushes on load", async () => {
    const player = new YouTubeVideoPlayer();
    const container = makeContainer();
    player.attachTo(container);

    const cb = vi.fn();
    player.onReady(cb);

    await player.load(ytMedia);

    const ytInstance = mockedCreate.mock.results[0].value;
    expect(ytInstance.onReady).toHaveBeenCalledWith(cb);
  });

  it("forwards onEnded directly to the underlying player after load", async () => {
    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());
    await player.load(ytMedia);

    const ytInstance = mockedCreate.mock.results[0].value;
    const cb = vi.fn();
    player.onEnded(cb);
    expect(ytInstance.onEnded).toHaveBeenCalledWith(cb);
  });

  it("delegates play/pause/stop/setVolume/getCurrentTime to the underlying player", async () => {
    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());
    await player.load(ytMedia);

    const ytInstance = mockedCreate.mock.results[0].value;
    ytInstance.getCurrentTime.mockReturnValue(12.5);

    await player.play();
    player.pause();
    player.stop();
    player.setVolume(0.42);
    expect(player.getCurrentTime()).toBe(12.5);

    expect(ytInstance.play).toHaveBeenCalledTimes(1);
    expect(ytInstance.pause).toHaveBeenCalledTimes(1);
    expect(ytInstance.stop).toHaveBeenCalledTimes(1);
    expect(ytInstance.setVolume).toHaveBeenCalledWith(0.42);
  });

  it("destroys the underlying player and clears state", async () => {
    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());
    await player.load(ytMedia);

    const ytInstance = mockedCreate.mock.results[0].value;
    player.destroy();

    expect(ytInstance.destroy).toHaveBeenCalledTimes(1);
    // After destroy, getCurrentTime returns 0 and pause is a no-op.
    expect(player.getCurrentTime()).toBe(0);
    player.pause(); // should not throw
  });

  it("buffered onEnded subscription can be unsubscribed after load", async () => {
    // Regression: previously the unsubscribe closure only targeted the local
    // buffered array, so calling it after load() was a no-op and the real YT
    // listener leaked.
    const realUnsub = vi.fn();
    const ytInstance = {
      load: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      stop: vi.fn(),
      setVolume: vi.fn(),
      onEnded: vi.fn().mockReturnValue(realUnsub),
      onReady: vi.fn().mockReturnValue(() => {}),
      getCurrentTime: vi.fn().mockReturnValue(0),
      destroy: vi.fn(),
    };
    mockedCreate.mockReturnValueOnce(ytInstance as never);

    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());

    const cb = vi.fn();
    const unsubscribe = player.onEnded(cb);

    await player.load(ytMedia);

    // After load, the buffered callback should be attached to the real player.
    expect(ytInstance.onEnded).toHaveBeenCalledWith(cb);
    expect(realUnsub).not.toHaveBeenCalled();

    // Now the unsubscribe returned before load must actually detach the
    // real listener.
    unsubscribe();
    expect(realUnsub).toHaveBeenCalledTimes(1);
  });

  it("buffered onReady subscription can be unsubscribed after load", async () => {
    const realUnsub = vi.fn();
    const ytInstance = {
      load: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      stop: vi.fn(),
      setVolume: vi.fn(),
      onEnded: vi.fn().mockReturnValue(() => {}),
      onReady: vi.fn().mockReturnValue(realUnsub),
      getCurrentTime: vi.fn().mockReturnValue(0),
      destroy: vi.fn(),
    };
    mockedCreate.mockReturnValueOnce(ytInstance as never);

    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());

    const cb = vi.fn();
    const unsubscribe = player.onReady(cb);

    await player.load(ytMedia);
    expect(ytInstance.onReady).toHaveBeenCalledWith(cb);

    unsubscribe();
    expect(realUnsub).toHaveBeenCalledTimes(1);
  });

  it("destroys the previous YT player when load is called twice", async () => {
    const player = new YouTubeVideoPlayer();
    player.attachTo(makeContainer());
    await player.load(ytMedia);
    const first = mockedCreate.mock.results[0].value;

    await player.load({ ...ytMedia, videoId: "zzzZZZ99999" });

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });
});
