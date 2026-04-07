import { describe, it, expect, beforeEach, vi } from "vitest";
import { createVoiceManager } from "./VoiceManager";
import type { AudioGraph } from "./audioGraph";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockGainParam {
  value = 0;
  linearRampToValueAtTime = vi.fn();
  setValueAtTime = vi.fn();
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

const allAudios: MockAudio[] = [];

class MockAudio {
  src = "";
  crossOrigin: string | null = null;
  preload = "";
  volume = 1;
  currentTime = 0;
  paused = true;
  private listeners: Record<string, Array<(e?: unknown) => void>> = {};
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  addEventListener = vi.fn((event: string, cb: (e?: unknown) => void) => {
    (this.listeners[event] ||= []).push(cb);
  });
  removeEventListener = vi.fn((event: string, cb: (e?: unknown) => void) => {
    const list = this.listeners[event];
    if (!list) return;
    const i = list.indexOf(cb);
    if (i >= 0) list.splice(i, 1);
  });
  // Test helper — fire a registered event
  _fire(event: string, e?: unknown): void {
    for (const cb of [...(this.listeners[event] || [])]) {
      cb(e);
    }
  }
  constructor() {
    allAudios.push(this);
  }
}

beforeEach(() => {
  allAudios.length = 0;
  // @ts-expect-error - test override
  global.Audio = MockAudio;
  // @ts-expect-error - test override
  global.HTMLAudioElement = MockAudio;
});

function makeGraph(): AudioGraph {
  const ctx = new MockAudioContext();
  const voiceGain = new MockGainNode();
  return {
    ctx: ctx as unknown as AudioContext,
    masterGain: new MockGainNode() as unknown as GainNode,
    getGainNode: (_ch: string) => voiceGain as unknown as GainNode,
    setChannelVolume: vi.fn(),
    dispose: vi.fn(),
  };
}

// Wait for play() promise microtask to flush.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VoiceManager", () => {
  it("creates a single reused HTMLAudioElement", () => {
    createVoiceManager({ graph: makeGraph() });
    expect(allAudios.length).toBe(1);
  });

  it("enqueue one clip starts playback and exposes current voice id", () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    mgr.enqueue({ id: "v1", url: "https://example.com/v1.mp3" });
    expect(mgr.getCurrentVoiceId()).toBe("v1");
    const audio = allAudios[0];
    expect(audio.src).toBe("https://example.com/v1.mp3");
    expect(audio.play).toHaveBeenCalled();
  });

  it("enqueue two clips: first plays, second waits in queue until ended fires", () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    const ended: string[] = [];
    mgr.onEnded((id) => ended.push(id));

    mgr.enqueue({ id: "v1", url: "u1" });
    mgr.enqueue({ id: "v2", url: "u2" });

    expect(mgr.getCurrentVoiceId()).toBe("v1");
    const audio = allAudios[0];
    expect(audio.src).toBe("u1");

    audio._fire("ended");
    expect(ended).toEqual(["v1"]);
    expect(mgr.getCurrentVoiceId()).toBe("v2");
    expect(audio.src).toBe("u2");

    audio._fire("ended");
    expect(ended).toEqual(["v1", "v2"]);
    expect(mgr.getCurrentVoiceId()).toBe(null);
  });

  it("enqueue three clips plays them in FIFO order", () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    const ended: string[] = [];
    mgr.onEnded((id) => ended.push(id));

    mgr.enqueue({ id: "a", url: "ua" });
    mgr.enqueue({ id: "b", url: "ub" });
    mgr.enqueue({ id: "c", url: "uc" });

    const audio = allAudios[0];
    expect(audio.src).toBe("ua");
    audio._fire("ended");
    expect(audio.src).toBe("ub");
    audio._fire("ended");
    expect(audio.src).toBe("uc");
    audio._fire("ended");
    expect(ended).toEqual(["a", "b", "c"]);
    expect(mgr.getCurrentVoiceId()).toBe(null);
  });

  it("stopAll mid-playback clears queue and current id, does NOT fire onEnded", () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    const ended: string[] = [];
    mgr.onEnded((id) => ended.push(id));

    mgr.enqueue({ id: "v1", url: "u1" });
    mgr.enqueue({ id: "v2", url: "u2" });

    const audio = allAudios[0];
    mgr.stopAll();

    expect(mgr.getCurrentVoiceId()).toBe(null);
    expect(audio.pause).toHaveBeenCalled();
    expect(ended).toEqual([]);

    // Stale ended event after stopAll should be ignored.
    audio._fire("ended");
    expect(ended).toEqual([]);
    expect(mgr.getCurrentVoiceId()).toBe(null);
  });

  it("onEnded unsubscribe removes the callback", () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    const ended: string[] = [];
    const unsub = mgr.onEnded((id) => ended.push(id));

    mgr.enqueue({ id: "v1", url: "u1" });
    const audio = allAudios[0];
    audio._fire("ended");
    expect(ended).toEqual(["v1"]);

    unsub();
    mgr.enqueue({ id: "v2", url: "u2" });
    audio._fire("ended");
    expect(ended).toEqual(["v1"]);
  });

  it("error event during playback advances queue and fires onEnded", () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    const ended: string[] = [];
    mgr.onEnded((id) => ended.push(id));

    mgr.enqueue({ id: "v1", url: "u1" });
    mgr.enqueue({ id: "v2", url: "u2" });

    const audio = allAudios[0];
    audio._fire("error");
    expect(ended).toEqual(["v1"]);
    expect(mgr.getCurrentVoiceId()).toBe("v2");
    expect(audio.src).toBe("u2");
  });

  it("play() promise rejection treats clip as ended and advances", async () => {
    const mgr = createVoiceManager({ graph: makeGraph() });
    const ended: string[] = [];
    mgr.onEnded((id) => ended.push(id));

    const audio = allAudios[0];
    // First clip rejects, subsequent ones resolve.
    audio.play = vi
      .fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValue(undefined);

    mgr.enqueue({ id: "v1", url: "u1" });
    mgr.enqueue({ id: "v2", url: "u2" });

    await flush();

    expect(ended).toEqual(["v1"]);
    expect(mgr.getCurrentVoiceId()).toBe("v2");
    expect(audio.src).toBe("u2");
  });

  it("dispose stops playback and rejects further enqueue", () => {
    const graph = makeGraph();
    const mgr = createVoiceManager({ graph });
    mgr.enqueue({ id: "v1", url: "u1" });
    const audio = allAudios[0];

    mgr.dispose();
    expect(mgr.getCurrentVoiceId()).toBe(null);
    expect(audio.pause).toHaveBeenCalled();

    // Source disconnect was called.
    const ctxMock = graph.ctx as unknown as MockAudioContext;
    const sources = ctxMock.createMediaElementSource.mock.results.map(
      (r) => r.value as MockMediaElementSource,
    );
    for (const s of sources) {
      expect(s.disconnect).toHaveBeenCalled();
    }

    // Post-dispose enqueue is a no-op.
    const playCallsBefore = audio.play.mock.calls.length;
    mgr.enqueue({ id: "v2", url: "u2" });
    expect(mgr.getCurrentVoiceId()).toBe(null);
    expect(audio.play.mock.calls.length).toBe(playCallsBefore);
  });
});
