import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAudioOrchestrator } from "./AudioOrchestrator";
import type { AudioGraph } from "./audioGraph";
import type { BgmManager } from "./BgmManager";
import type { VoiceManager } from "./VoiceManager";
import type { YouTubePlayer } from "./YouTubePlayer";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeGraph(): AudioGraph {
  return {
    ctx: {} as AudioContext,
    masterGain: {} as GainNode,
    getGainNode: vi.fn(() => ({}) as GainNode),
    setChannelVolume: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeBgmManager(): BgmManager {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    getCurrentTrackId: vi.fn(() => null),
  };
}

function makeVoiceManager(): VoiceManager {
  const subs = new Set<(id: string) => void>();
  return {
    enqueue: vi.fn(),
    stopAll: vi.fn(),
    onEnded: vi.fn((cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    }),
    getCurrentVoiceId: vi.fn(() => null),
    dispose: vi.fn(),
  };
}

function makeYtPlayer(): YouTubePlayer {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    onEnded: vi.fn(() => () => undefined),
    onReady: vi.fn(() => () => undefined),
    destroy: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
  };
}

interface Harness {
  graph: AudioGraph;
  bgmManager: BgmManager;
  voiceManager: VoiceManager;
  audioManager: { playSound: ReturnType<typeof vi.fn> };
  onBgmMediaIdChange: ReturnType<typeof vi.fn>;
  ytPlayers: YouTubePlayer[];
  createYouTubePlayer: ReturnType<typeof vi.fn>;
  orchestrator: ReturnType<typeof createAudioOrchestrator>;
}

function setup(): Harness {
  const graph = makeGraph();
  const bgmManager = makeBgmManager();
  const voiceManager = makeVoiceManager();
  const audioManager = { playSound: vi.fn().mockResolvedValue(undefined) };
  const onBgmMediaIdChange = vi.fn();
  const ytPlayers: YouTubePlayer[] = [];
  const createYouTubePlayer = vi.fn(() => {
    const p = makeYtPlayer();
    ytPlayers.push(p);
    return p;
  });

  const orchestrator = createAudioOrchestrator({
    graph,
    bgmManager,
    voiceManager,
    audioManager,
    onBgmMediaIdChange,
    createYouTubePlayer,
  });

  return {
    graph,
    bgmManager,
    voiceManager,
    audioManager,
    onBgmMediaIdChange,
    ytPlayers,
    createYouTubePlayer,
    orchestrator,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AudioOrchestrator", () => {
  let h: Harness;

  beforeEach(() => {
    h = setup();
  });

  describe("handleSetBgm — FILE source", () => {
    it("calls bgmManager.play with the track", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "m1",
        sourceType: "FILE",
        url: "https://example.com/a.mp3",
      });
      expect(h.bgmManager.play).toHaveBeenCalledWith({
        id: "m1",
        url: "https://example.com/a.mp3",
      });
      expect(h.onBgmMediaIdChange).toHaveBeenCalledWith("m1");
    });

    it("ignores FILE payload missing url", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "m1",
        sourceType: "FILE",
      });
      expect(h.bgmManager.play).not.toHaveBeenCalled();
    });
  });

  describe("handleSetBgm — YOUTUBE source", () => {
    it("creates a YT player in hidden mode and plays", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "yt1",
        sourceType: "YOUTUBE",
        videoId: "abc12345678",
      });
      expect(h.createYouTubePlayer).toHaveBeenCalledTimes(1);
      const yt = h.ytPlayers[0];
      expect(yt.load).toHaveBeenCalledWith({
        videoId: "abc12345678",
        hidden: true,
      });
      expect(yt.play).toHaveBeenCalled();
      expect(h.onBgmMediaIdChange).toHaveBeenCalledWith("yt1");
    });

    it("ignores YOUTUBE payload missing videoId", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "yt1",
        sourceType: "YOUTUBE",
      });
      expect(h.createYouTubePlayer).not.toHaveBeenCalled();
    });
  });

  describe("source switching", () => {
    it("FILE → YOUTUBE: stops bgmManager and creates YT player", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
        fadeMs: 500,
      });
      expect(h.bgmManager.stop).toHaveBeenCalledWith(500);
      expect(h.createYouTubePlayer).toHaveBeenCalledTimes(1);
      expect(h.onBgmMediaIdChange).toHaveBeenLastCalledWith("y1");
    });

    it("YOUTUBE → FILE: destroys YT player and calls bgmManager.play", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
      });
      const yt = h.ytPlayers[0];
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      expect(yt.destroy).toHaveBeenCalled();
      expect(h.bgmManager.play).toHaveBeenCalledWith({ id: "f1", url: "u1" });
    });

    it("YOUTUBE → YOUTUBE: destroys previous and creates new player", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid11111111",
      });
      const yt1 = h.ytPlayers[0];
      await h.orchestrator.handleSetBgm({
        mediaId: "y2",
        sourceType: "YOUTUBE",
        videoId: "vid22222222",
      });
      expect(yt1.destroy).toHaveBeenCalled();
      expect(h.ytPlayers).toHaveLength(2);
    });

    it("same mediaId → idempotent (no duplicate action)", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "m1",
        sourceType: "FILE",
        url: "u1",
      });
      await h.orchestrator.handleSetBgm({
        mediaId: "m1",
        sourceType: "FILE",
        url: "u1",
      });
      expect(h.bgmManager.play).toHaveBeenCalledTimes(1);
      expect(h.onBgmMediaIdChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("handlePlayVoice", () => {
    it("calls voiceManager.enqueue", () => {
      h.orchestrator.handlePlayVoice({ mediaId: "v1", url: "voice.mp3" });
      expect(h.voiceManager.enqueue).toHaveBeenCalledWith({
        id: "v1",
        url: "voice.mp3",
      });
    });
  });

  describe("handlePlayMedia (SFX delegation)", () => {
    it("delegates to audioManager.playSound", async () => {
      await h.orchestrator.handlePlayMedia({ mediaId: "s1", url: "sfx.mp3" });
      expect(h.audioManager.playSound).toHaveBeenCalledWith("sfx.mp3");
    });

    it("noop when audioManager not provided", async () => {
      const orch = createAudioOrchestrator({
        graph: h.graph,
        bgmManager: h.bgmManager,
        voiceManager: h.voiceManager,
      });
      await expect(
        orch.handlePlayMedia({ mediaId: "s1", url: "sfx.mp3" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("handleStopAll", () => {
    it("stops voice and bgm (FILE) and clears bgm state", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      h.orchestrator.handleStopAll();
      expect(h.voiceManager.stopAll).toHaveBeenCalled();
      expect(h.bgmManager.stop).toHaveBeenCalled();
      expect(h.onBgmMediaIdChange).toHaveBeenLastCalledWith(null);
    });

    it("destroys YT player when active YOUTUBE", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
      });
      const yt = h.ytPlayers[0];
      h.orchestrator.handleStopAll();
      expect(yt.destroy).toHaveBeenCalled();
      expect(h.onBgmMediaIdChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe("cutscene bgmBehavior", () => {
    it("'pause' with active FILE bgm → bgmManager.pause", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      h.orchestrator.handleCutsceneStart("pause");
      expect(h.bgmManager.pause).toHaveBeenCalled();
    });

    it("'pause' with active YOUTUBE bgm → ytPlayer.pause", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
      });
      const yt = h.ytPlayers[0];
      h.orchestrator.handleCutsceneStart("pause");
      expect(yt.pause).toHaveBeenCalled();
    });

    it("'pause' then end → resumes file source", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      h.orchestrator.handleCutsceneStart("pause");
      h.orchestrator.handleCutsceneEnd();
      expect(h.bgmManager.resume).toHaveBeenCalled();
    });

    it("'pause' then end → resumes youtube source", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
      });
      const yt = h.ytPlayers[0];
      (yt.play as ReturnType<typeof vi.fn>).mockClear();
      h.orchestrator.handleCutsceneStart("pause");
      h.orchestrator.handleCutsceneEnd();
      expect(yt.play).toHaveBeenCalled();
    });

    it("'keep' → no bgm manipulation, end is no-op", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      h.orchestrator.handleCutsceneStart("keep");
      expect(h.bgmManager.pause).not.toHaveBeenCalled();
      expect(h.bgmManager.stop).not.toHaveBeenCalled();
      h.orchestrator.handleCutsceneEnd();
      expect(h.bgmManager.resume).not.toHaveBeenCalled();
    });

    it("'stop' → full BGM teardown (FILE)", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      h.orchestrator.handleCutsceneStart("stop");
      expect(h.bgmManager.stop).toHaveBeenCalled();
      expect(h.onBgmMediaIdChange).toHaveBeenLastCalledWith(null);
    });

    it("'stop' → full BGM teardown (YOUTUBE)", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
      });
      const yt = h.ytPlayers[0];
      h.orchestrator.handleCutsceneStart("stop");
      expect(yt.destroy).toHaveBeenCalled();
      expect(h.onBgmMediaIdChange).toHaveBeenLastCalledWith(null);
    });

    it("'stop' end → does NOT resume (only pause behavior resumes)", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      h.orchestrator.handleCutsceneStart("stop");
      h.orchestrator.handleCutsceneEnd();
      expect(h.bgmManager.resume).not.toHaveBeenCalled();
    });
  });

  describe("setChannelVolume", () => {
    it("delegates to graph.setChannelVolume", () => {
      h.orchestrator.setChannelVolume("bgm", 0.42);
      expect(h.graph.setChannelVolume).toHaveBeenCalledWith("bgm", 0.42);
    });
  });

  describe("setReadingVoiceEndedHandler", () => {
    it("subscribes via voiceManager.onEnded and returns unsubscribe", () => {
      const cb = vi.fn();
      const unsub = h.orchestrator.setReadingVoiceEndedHandler(cb);
      expect(h.voiceManager.onEnded).toHaveBeenCalledWith(cb);
      expect(typeof unsub).toBe("function");
    });
  });

  describe("dispose", () => {
    it("destroys YT, disposes bgm/voice managers", async () => {
      await h.orchestrator.handleSetBgm({
        mediaId: "y1",
        sourceType: "YOUTUBE",
        videoId: "vid12345678",
      });
      const yt = h.ytPlayers[0];
      h.orchestrator.dispose();
      expect(yt.destroy).toHaveBeenCalled();
      expect(h.bgmManager.dispose).toHaveBeenCalled();
      expect(h.voiceManager.dispose).toHaveBeenCalled();
    });

    it("subsequent operations are no-ops after dispose", async () => {
      h.orchestrator.dispose();
      await h.orchestrator.handleSetBgm({
        mediaId: "f1",
        sourceType: "FILE",
        url: "u1",
      });
      expect(h.bgmManager.play).not.toHaveBeenCalled();
    });
  });
});
