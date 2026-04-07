import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createBgmManager } from "./BgmManager";
import type { AudioGraph } from "./audioGraph";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockGainParam {
  value = 0;
  linearRampToValueAtTime = vi.fn((v: number, _t: number) => {
    this.value = v;
  });
  setValueAtTime = vi.fn((v: number, _t: number) => {
    this.value = v;
  });
  cancelScheduledValues = vi.fn();
}

class MockGainNode {
  gain = new MockGainParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockMediaElementSource {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  state: "running" | "suspended" = "running";
  destination = {} as unknown;
  resume = vi.fn().mockResolvedValue(undefined);
  createGain = vi.fn(() => new MockGainNode());
  createMediaElementSource = vi.fn(() => new MockMediaElementSource());
}

let audioCtorCalls = 0;
const allAudios: MockAudio[] = [];

class MockAudio {
  src = "";
  crossOrigin: string | null = null;
  preload = "";
  volume = 1;
  currentTime = 0;
  paused = true;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor() {
    audioCtorCalls++;
    allAudios.push(this);
  }
}

beforeEach(() => {
  audioCtorCalls = 0;
  allAudios.length = 0;
  // @ts-expect-error - test override
  global.Audio = MockAudio;
  // @ts-expect-error - test override
  global.HTMLAudioElement = MockAudio;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeGraph(): AudioGraph {
  const ctx = new MockAudioContext();
  const bgmGain = new MockGainNode();
  return {
    ctx: ctx as unknown as AudioContext,
    masterGain: new MockGainNode() as unknown as GainNode,
    getGainNode: (_ch: string) => bgmGain as unknown as GainNode,
    setChannelVolume: vi.fn(),
    dispose: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BgmManager", () => {
  it("creates two slots (dual-slot pattern)", () => {
    createBgmManager({ graph: makeGraph() });
    // Two HTMLAudioElement instances created up-front, one per slot.
    expect(audioCtorCalls).toBe(2);
  });

  it("play loads url into a slot and starts playback", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "https://example.com/bgm.mp3" });
    expect(mgr.getCurrentTrackId()).toBe("t1");
    // One of the two slots should have the URL set and be playing.
    const playing = allAudios.filter((a) => a.src === "https://example.com/bgm.mp3");
    expect(playing.length).toBe(1);
    expect(playing[0].play).toHaveBeenCalled();
  });

  it("play with same id is a no-op", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "u1" });
    const playCallsBefore = allAudios.reduce((n, a) => n + a.play.mock.calls.length, 0);
    await mgr.play({ id: "t1", url: "u1" });
    const playCallsAfter = allAudios.reduce((n, a) => n + a.play.mock.calls.length, 0);
    expect(playCallsAfter).toBe(playCallsBefore);
    expect(mgr.getCurrentTrackId()).toBe("t1");
  });

  it("play new track starts crossfade and updates current track id", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "u1" });
    await mgr.play({ id: "t2", url: "u2" });
    expect(mgr.getCurrentTrackId()).toBe("t2");
    // Both slots have been engaged.
    const playingAudios = allAudios.filter((a) => a.play.mock.calls.length > 0);
    expect(playingAudios.length).toBe(2);
  });

  it("crossfade uses linearRampToValueAtTime on gain nodes", async () => {
    const graph = makeGraph();
    const mgr = createBgmManager({ graph });
    await mgr.play({ id: "t1", url: "u1" });
    await mgr.play({ id: "t2", url: "u2" });
    // Walk all gain nodes ever created via createGain on the ctx, find ramps.
    const ctxMock = graph.ctx as unknown as MockAudioContext;
    const allGains = ctxMock.createGain.mock.results.map((r) => r.value as MockGainNode);
    const totalRamps = allGains.reduce(
      (n, g) => n + g.gain.linearRampToValueAtTime.mock.calls.length,
      0,
    );
    // At least 3 ramps: t1 fade-in, t1 fade-out, t2 fade-in.
    expect(totalRamps).toBeGreaterThanOrEqual(3);
  });

  it("mid-crossfade override settles previous fade and starts new one", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "u1" });
    // Start second play but don't advance time (crossfade in flight).
    await mgr.play({ id: "t2", url: "u2" });
    // Third play arrives mid-crossfade.
    await mgr.play({ id: "t3", url: "u3" });
    expect(mgr.getCurrentTrackId()).toBe("t3");
  });

  it("stop fades out and clears current track", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "u1" });
    const stopPromise = mgr.stop();
    // Synchronous side effect: current track immediately cleared.
    expect(mgr.getCurrentTrackId()).toBe(null);
    vi.advanceTimersByTime(2000);
    await stopPromise;
  });

  it("stop with no current track is a no-op", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await expect(mgr.stop()).resolves.toBeUndefined();
    expect(mgr.getCurrentTrackId()).toBe(null);
  });

  it("pause pauses the active audio element", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "u1" });
    const playing = allAudios.find((a) => a.src === "u1")!;
    mgr.pause();
    expect(playing.pause).toHaveBeenCalled();
  });

  it("resume resumes the active audio element after pause", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    await mgr.play({ id: "t1", url: "u1" });
    const playing = allAudios.find((a) => a.src === "u1")!;
    const playCallsBefore = playing.play.mock.calls.length;
    mgr.pause();
    mgr.resume();
    expect(playing.play.mock.calls.length).toBeGreaterThan(playCallsBefore);
    expect(mgr.getCurrentTrackId()).toBe("t1");
  });

  it("dispose disconnects gain/source nodes and clears state", async () => {
    const graph = makeGraph();
    const mgr = createBgmManager({ graph });
    await mgr.play({ id: "t1", url: "u1" });
    mgr.dispose();
    expect(mgr.getCurrentTrackId()).toBe(null);
    const ctxMock = graph.ctx as unknown as MockAudioContext;
    const allGains = ctxMock.createGain.mock.results.map((r) => r.value as MockGainNode);
    // Each slot's gain should be disconnected.
    for (const g of allGains) {
      expect(g.disconnect).toHaveBeenCalled();
    }
    const allSources = ctxMock.createMediaElementSource.mock.results.map(
      (r) => r.value as MockMediaElementSource,
    );
    for (const s of allSources) {
      expect(s.disconnect).toHaveBeenCalled();
    }
  });

  it("subsequent play after dispose is a no-op", async () => {
    const mgr = createBgmManager({ graph: makeGraph() });
    mgr.dispose();
    await mgr.play({ id: "t1", url: "u1" });
    expect(mgr.getCurrentTrackId()).toBe(null);
  });
});
