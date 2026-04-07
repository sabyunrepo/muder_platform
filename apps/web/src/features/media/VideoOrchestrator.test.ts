import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVideoOrchestrator } from "./VideoOrchestrator";
import type { VideoMedia, VideoPlayer } from "./VideoPlayer";

interface MockPlayer extends VideoPlayer {
  _endedCb: (() => void) | null;
}

function makeMockPlayer(): MockPlayer {
  const player: MockPlayer = {
    load: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    onEnded: vi.fn((cb: () => void) => {
      player._endedCb = cb;
      return () => {};
    }),
    onReady: vi.fn(() => () => {}),
    attachTo: vi.fn(),
    destroy: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    _endedCb: null,
  };
  return player;
}

function makeAudio() {
  return {
    handleCutsceneStart: vi.fn(),
    handleCutsceneEnd: vi.fn(),
  };
}

const youtubeMedia: VideoMedia = {
  id: "m1",
  sourceType: "YOUTUBE",
  videoId: "abc",
};

describe("VideoOrchestrator", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("playCutscene creates player, attaches container, loads, plays", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const factory = vi.fn().mockReturnValue(player);
    const container = document.createElement("div");

    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: factory,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: true,
      container,
    });

    expect(factory).toHaveBeenCalledWith("YOUTUBE");
    expect(player.attachTo).toHaveBeenCalledWith(container);
    expect(player.load).toHaveBeenCalledWith(youtubeMedia);
    expect(player.play).toHaveBeenCalled();
    expect(orch.isPlaying()).toBe(true);
    expect(orch.getCurrentMediaId()).toBe("m1");
  });

  it("playCutscene calls audioOrchestrator.handleCutsceneStart with bgmBehavior", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: false,
      container: document.createElement("div"),
    });

    expect(audio.handleCutsceneStart).toHaveBeenCalledWith("pause");
  });

  it("playCutscene subscribes to player.onEnded", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "keep",
      skippable: false,
      container: document.createElement("div"),
    });

    expect(player.onEnded).toHaveBeenCalled();
    expect(player._endedCb).toBeTypeOf("function");
  });

  it("when ended fires: calls audio.handleCutsceneEnd, onVideoEnded, localEndedCb, destroys", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const onVideoEnded = vi.fn();
    const localEnded = vi.fn();

    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
      onVideoEnded,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: true,
      container: document.createElement("div"),
      onEnded: localEnded,
    });

    player._endedCb!();

    expect(audio.handleCutsceneEnd).toHaveBeenCalledTimes(1);
    expect(onVideoEnded).toHaveBeenCalledWith("m1");
    expect(localEnded).toHaveBeenCalledTimes(1);
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(orch.isPlaying()).toBe(false);
    expect(orch.getCurrentMediaId()).toBeNull();
  });

  it("playCutscene while another is playing → ignored (singleton)", async () => {
    const audio = makeAudio();
    const player1 = makeMockPlayer();
    const player2 = makeMockPlayer();
    const factory = vi
      .fn()
      .mockReturnValueOnce(player1)
      .mockReturnValueOnce(player2);

    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: factory,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: true,
      container: document.createElement("div"),
    });

    await orch.playCutscene({
      media: { id: "m2", sourceType: "YOUTUBE", videoId: "xyz" },
      bgmBehavior: "stop",
      skippable: false,
      container: document.createElement("div"),
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(audio.handleCutsceneStart).toHaveBeenCalledTimes(1);
    expect(orch.getCurrentMediaId()).toBe("m1");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("isPlaying returns true during playback, false after ended", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
    });

    expect(orch.isPlaying()).toBe(false);

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: true,
      container: document.createElement("div"),
    });

    expect(orch.isPlaying()).toBe(true);

    player._endedCb!();

    expect(orch.isPlaying()).toBe(false);
  });

  it("skipCutscene triggers the ended flow", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const onVideoEnded = vi.fn();
    const localEnded = vi.fn();

    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
      onVideoEnded,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: true,
      container: document.createElement("div"),
      onEnded: localEnded,
    });

    orch.skipCutscene();

    expect(audio.handleCutsceneEnd).toHaveBeenCalledTimes(1);
    expect(onVideoEnded).toHaveBeenCalledWith("m1");
    expect(localEnded).toHaveBeenCalledTimes(1);
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(orch.isPlaying()).toBe(false);
  });

  it("skipCutscene with no active → no-op", () => {
    const audio = makeAudio();
    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => makeMockPlayer(),
    });

    expect(() => orch.skipCutscene()).not.toThrow();
    expect(audio.handleCutsceneEnd).not.toHaveBeenCalled();
  });

  it("dispose with active cutscene → skips and cleans up", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
    });

    await orch.playCutscene({
      media: youtubeMedia,
      bgmBehavior: "pause",
      skippable: true,
      container: document.createElement("div"),
    });

    orch.dispose();

    expect(audio.handleCutsceneEnd).toHaveBeenCalledTimes(1);
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(orch.isPlaying()).toBe(false);
    expect(orch.getCurrentMediaId()).toBeNull();
  });

  it("FILE source factory throws → propagates and rolls back audio", async () => {
    const audio = makeAudio();
    const factory = vi.fn(() => {
      throw new Error("FileVideoPlayer not implemented");
    });

    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: factory,
    });

    await expect(
      orch.playCutscene({
        media: { id: "f1", sourceType: "FILE", url: "https://x/y.mp4" },
        bgmBehavior: "pause",
        skippable: true,
        container: document.createElement("div"),
      }),
    ).rejects.toThrow("FileVideoPlayer not implemented");

    expect(audio.handleCutsceneStart).toHaveBeenCalledWith("pause");
    expect(audio.handleCutsceneEnd).toHaveBeenCalledTimes(1);
    expect(orch.isPlaying()).toBe(false);
    expect(orch.getCurrentMediaId()).toBeNull();
  });

  it("player.load rejection propagates and cleans up", async () => {
    const audio = makeAudio();
    const player = makeMockPlayer();
    (player.load as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("load failed"),
    );

    const orch = createVideoOrchestrator({
      audioOrchestrator: audio,
      createVideoPlayerFn: () => player,
    });

    await expect(
      orch.playCutscene({
        media: youtubeMedia,
        bgmBehavior: "pause",
        skippable: true,
        container: document.createElement("div"),
      }),
    ).rejects.toThrow("load failed");

    expect(player.destroy).toHaveBeenCalled();
    expect(audio.handleCutsceneEnd).toHaveBeenCalledTimes(1);
    expect(orch.isPlaying()).toBe(false);
  });
});
