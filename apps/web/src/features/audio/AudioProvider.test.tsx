import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — replace the audio stack factories with spies so we can assert
// construction + disposal without touching real Web Audio APIs (jsdom has
// no AudioContext).
// ---------------------------------------------------------------------------

const graphDispose = vi.fn();
const bgmDispose = vi.fn();
const voiceDispose = vi.fn();
const audioManagerDispose = vi.fn();
const orchestratorDispose = vi.fn();
const setChannelVolume = vi.fn();
const audioManagerSetVolume = vi.fn();

vi.mock("./audioContext", () => ({
  getAudioContext: vi.fn(() => ({}) as AudioContext),
  unlockAudioContext: vi.fn(),
}));

vi.mock("./audioGraph", () => ({
  createAudioGraph: vi.fn(() => ({
    ctx: {} as AudioContext,
    masterGain: {} as GainNode,
    getGainNode: vi.fn(),
    setChannelVolume: vi.fn(),
    dispose: graphDispose,
  })),
}));

vi.mock("./BgmManager", () => ({
  createBgmManager: vi.fn(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: bgmDispose,
    getCurrentTrackId: () => null,
  })),
}));

vi.mock("./VoiceManager", () => ({
  createVoiceManager: vi.fn(() => ({
    enqueue: vi.fn(),
    stopAll: vi.fn(),
    onEnded: vi.fn(() => () => undefined),
    getCurrentVoiceId: () => null,
    dispose: voiceDispose,
  })),
}));

vi.mock("./AudioManager", () => ({
  createAudioManager: vi.fn(() => ({
    play: vi.fn(),
    preload: vi.fn().mockResolvedValue(undefined),
    setVolume: audioManagerSetVolume,
    dispose: audioManagerDispose,
  })),
}));

vi.mock("./AudioOrchestrator", () => ({
  createAudioOrchestrator: vi.fn(() => ({
    handleSetBgm: vi.fn(),
    handlePlayVoice: vi.fn(),
    handlePlayMedia: vi.fn(),
    handleStopAll: vi.fn(),
    handleCutsceneStart: vi.fn(),
    handleCutsceneEnd: vi.fn(),
    setChannelVolume,
    setReadingVoiceEndedHandler: vi.fn(() => () => undefined),
    dispose: orchestratorDispose,
  })),
}));

// useGameSound + useGameMediaEvents are no-ops in this test (they pull WS
// state which we don't want to wire up).
vi.mock("./hooks/useGameSound", () => ({
  useGameSound: vi.fn(),
}));
vi.mock("./hooks/useGameMediaEvents", () => ({
  useGameMediaEvents: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mock setup
// ---------------------------------------------------------------------------

import { AudioProvider } from "./AudioProvider";
import { useAudioStore } from "@/stores/audioStore";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AudioProvider", () => {
  beforeEach(() => {
    graphDispose.mockClear();
    bgmDispose.mockClear();
    voiceDispose.mockClear();
    audioManagerDispose.mockClear();
    orchestratorDispose.mockClear();
    setChannelVolume.mockClear();
    audioManagerSetVolume.mockClear();
  });

  it("constructs the audio stack on mount and applies initial volumes", () => {
    render(<AudioProvider>child</AudioProvider>);

    // All four channels should be initialised.
    const channels = setChannelVolume.mock.calls.map((c) => c[0]);
    expect(channels).toContain("master");
    expect(channels).toContain("bgm");
    expect(channels).toContain("voice");
    expect(channels).toContain("sfx");
  });

  it("disposes orchestrator + graph + audioManager on unmount", () => {
    const { unmount } = render(<AudioProvider>child</AudioProvider>);
    unmount();

    expect(orchestratorDispose).toHaveBeenCalled();
    expect(audioManagerDispose).toHaveBeenCalled();
    expect(graphDispose).toHaveBeenCalled();
  });

  it("propagates audioStore volume changes to the orchestrator", () => {
    render(<AudioProvider>child</AudioProvider>);
    setChannelVolume.mockClear();

    useAudioStore.getState().setBgmVolume(0.42);
    expect(setChannelVolume).toHaveBeenCalledWith("bgm", 0.42);

    useAudioStore.getState().setVoiceVolume(0.33);
    expect(setChannelVolume).toHaveBeenCalledWith("voice", 0.33);

    useAudioStore.getState().setSfxVolume(0.21);
    expect(setChannelVolume).toHaveBeenCalledWith("sfx", 0.21);

    useAudioStore.getState().setMasterVolume(0.55);
    expect(setChannelVolume).toHaveBeenCalledWith("master", 0.55);
  });

  it("toggling mute drives master to 0", () => {
    // Ensure starting state is not muted.
    if (useAudioStore.getState().isMuted) {
      useAudioStore.getState().toggleMute();
    }
    render(<AudioProvider>child</AudioProvider>);
    setChannelVolume.mockClear();

    useAudioStore.getState().toggleMute(); // → muted
    expect(setChannelVolume).toHaveBeenCalledWith("master", 0);

    useAudioStore.getState().toggleMute(); // → unmuted
    cleanup();
  });
});
