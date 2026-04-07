import { describe, it, expect, beforeEach } from "vitest";
import { createAudioGraph, type AudioGraph } from "./audioGraph";

// ---------------------------------------------------------------------------
// Mock AudioContext for jsdom (no Web Audio API available)
// ---------------------------------------------------------------------------

class MockGainNode {
  gain = { value: 1 };
  connectedTo: unknown = null;
  connect(dest: unknown) {
    this.connectedTo = dest;
  }
  disconnect() {
    this.connectedTo = null;
  }
}

class MockAudioContext {
  destination = { name: "destination" };
  createGain() {
    return new MockGainNode();
  }
}

describe("audioGraph", () => {
  let ctx: MockAudioContext;
  let graph: AudioGraph;

  beforeEach(() => {
    ctx = new MockAudioContext();
    graph = createAudioGraph(ctx as unknown as AudioContext);
  });

  it("creates 4 gain nodes (master + bgm + voice + sfx)", () => {
    expect(graph.masterGain).toBeDefined();
    expect(graph.getGainNode("bgm")).toBeDefined();
    expect(graph.getGainNode("voice")).toBeDefined();
    expect(graph.getGainNode("sfx")).toBeDefined();
  });

  it("connects channel gains to master", () => {
    expect((graph.getGainNode("bgm") as unknown as MockGainNode).connectedTo).toBe(graph.masterGain);
    expect((graph.getGainNode("voice") as unknown as MockGainNode).connectedTo).toBe(graph.masterGain);
    expect((graph.getGainNode("sfx") as unknown as MockGainNode).connectedTo).toBe(graph.masterGain);
  });

  it("connects master to destination", () => {
    expect((graph.masterGain as unknown as MockGainNode).connectedTo).toBe(ctx.destination);
  });

  it('getGainNode("master") returns masterGain', () => {
    expect(graph.getGainNode("master")).toBe(graph.masterGain);
  });

  it("applies default channel volumes (bgm=0.6, voice=1.0, sfx=0.7)", () => {
    expect(graph.getGainNode("bgm").gain.value).toBe(0.6);
    expect(graph.getGainNode("voice").gain.value).toBe(1.0);
    expect(graph.getGainNode("sfx").gain.value).toBe(0.7);
    expect(graph.masterGain.gain.value).toBe(1);
  });

  it("setChannelVolume clamps 0..1", () => {
    graph.setChannelVolume("bgm", 0.5);
    expect(graph.getGainNode("bgm").gain.value).toBe(0.5);
    graph.setChannelVolume("bgm", 1.5);
    expect(graph.getGainNode("bgm").gain.value).toBe(1);
    graph.setChannelVolume("bgm", -0.1);
    expect(graph.getGainNode("bgm").gain.value).toBe(0);
  });

  it("setChannelVolume on master works", () => {
    graph.setChannelVolume("master", 0.8);
    expect(graph.masterGain.gain.value).toBe(0.8);
  });

  it("setChannelVolume on voice and sfx independently", () => {
    graph.setChannelVolume("voice", 0.3);
    graph.setChannelVolume("sfx", 0.9);
    expect(graph.getGainNode("voice").gain.value).toBe(0.3);
    expect(graph.getGainNode("sfx").gain.value).toBe(0.9);
    // bgm untouched
    expect(graph.getGainNode("bgm").gain.value).toBe(0.6);
  });

  it("dispose disconnects all nodes", () => {
    graph.dispose();
    expect((graph.masterGain as unknown as MockGainNode).connectedTo).toBe(null);
    expect((graph.getGainNode("bgm") as unknown as MockGainNode).connectedTo).toBe(null);
    expect((graph.getGainNode("voice") as unknown as MockGainNode).connectedTo).toBe(null);
    expect((graph.getGainNode("sfx") as unknown as MockGainNode).connectedTo).toBe(null);
  });
});
