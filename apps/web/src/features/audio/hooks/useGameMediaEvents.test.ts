import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Mocks: useWsEvent — captures every (eventType, handler) registration so the
// test can dispatch fake messages directly without spinning up a real
// WsClient.
// ---------------------------------------------------------------------------

const handlers = new Map<string, (payload: unknown, seq: number) => void>();

vi.mock("@/hooks/useWsEvent", () => ({
  useWsEvent: (
    _endpoint: "game" | "social",
    eventType: string,
    handler: (payload: unknown, seq: number) => void,
  ) => {
    handlers.set(eventType, handler);
  },
}));

// connectionStore — provides a stub gameClient with a `send` spy.
const sendSpy = vi.fn();

vi.mock("@/stores/connectionStore", () => ({
  useConnectionStore: Object.assign(() => null, {
    getState: () => ({
      gameClient: { send: sendSpy },
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mock setup
// ---------------------------------------------------------------------------

import { useGameMediaEvents } from "./useGameMediaEvents";
import { AudioOrchestratorContext } from "../audioOrchestratorContext";
import type { AudioOrchestrator } from "../AudioOrchestrator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrchestrator(): AudioOrchestrator {
  const endedSubs = new Set<(id: string) => void>();
  return {
    handleSetBgm: vi.fn().mockResolvedValue(undefined),
    handlePlayVoice: vi.fn(),
    handlePlayMedia: vi.fn().mockResolvedValue(undefined),
    handleStopAll: vi.fn(),
    handleCutsceneStart: vi.fn(),
    handleCutsceneEnd: vi.fn(),
    setChannelVolume: vi.fn(),
    setReadingVoiceEndedHandler: vi.fn((cb: (id: string) => void) => {
      endedSubs.add(cb);
      return () => endedSubs.delete(cb);
    }),
    dispose: vi.fn(),
    // test-only escape hatch
    __fireVoiceEnded: (id: string) => {
      for (const cb of endedSubs) cb(id);
    },
  } as unknown as AudioOrchestrator & { __fireVoiceEnded: (id: string) => void };
}

function renderWithOrchestrator(orchestrator: AudioOrchestrator | null) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      AudioOrchestratorContext.Provider,
      { value: { orchestrator } },
      children,
    );
  return renderHook(() => useGameMediaEvents(), { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGameMediaEvents", () => {
  beforeEach(() => {
    handlers.clear();
    sendSpy.mockClear();
  });

  it("registers handlers for all 4 audio:* events", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    expect(handlers.has(WsEventType.AUDIO_SET_BGM)).toBe(true);
    expect(handlers.has(WsEventType.AUDIO_PLAY_VOICE)).toBe(true);
    expect(handlers.has(WsEventType.AUDIO_PLAY_MEDIA)).toBe(true);
    expect(handlers.has(WsEventType.AUDIO_STOP)).toBe(true);
  });

  it("routes audio:set_bgm → orchestrator.handleSetBgm", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    const payload = {
      mediaId: "m1",
      sourceType: "FILE" as const,
      url: "https://example.com/a.mp3",
    };
    handlers.get(WsEventType.AUDIO_SET_BGM)!(payload, 1);

    expect(orch.handleSetBgm).toHaveBeenCalledWith(payload);
  });

  it("routes audio:play_voice → orchestrator.handlePlayVoice", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    const payload = { mediaId: "v1", url: "voice.mp3" };
    handlers.get(WsEventType.AUDIO_PLAY_VOICE)!(payload, 1);

    expect(orch.handlePlayVoice).toHaveBeenCalledWith(payload);
  });

  it("routes audio:play_media → orchestrator.handlePlayMedia", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    const payload = { mediaId: "s1", url: "sfx.mp3", mode: "inline" as const };
    handlers.get(WsEventType.AUDIO_PLAY_MEDIA)!(payload, 1);

    expect(orch.handlePlayMedia).toHaveBeenCalledWith(payload);
  });

  it("routes audio:stop → orchestrator.handleStopAll", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    handlers.get(WsEventType.AUDIO_STOP)!({}, 1);

    expect(orch.handleStopAll).toHaveBeenCalled();
  });

  it("does NOT call orchestrator methods when orchestrator is null", () => {
    renderWithOrchestrator(null);

    // All handlers should still be registered but be no-ops.
    expect(() => {
      handlers.get(WsEventType.AUDIO_SET_BGM)!(
        { mediaId: "m1", sourceType: "FILE" as const, url: "u" },
        1,
      );
      handlers.get(WsEventType.AUDIO_PLAY_VOICE)!(
        { mediaId: "v1", url: "u" },
        1,
      );
      handlers.get(WsEventType.AUDIO_PLAY_MEDIA)!({ mediaId: "s1" }, 1);
      handlers.get(WsEventType.AUDIO_STOP)!({}, 1);
    }).not.toThrow();
  });

  it("registers a reading-voice-ended handler on the orchestrator", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    expect(orch.setReadingVoiceEndedHandler).toHaveBeenCalledTimes(1);
  });

  it("sends reading:voice_ended via gameClient when voice ends", () => {
    const orch = makeOrchestrator() as AudioOrchestrator & {
      __fireVoiceEnded: (id: string) => void;
    };
    renderWithOrchestrator(orch);

    orch.__fireVoiceEnded("voice-42");

    expect(sendSpy).toHaveBeenCalledWith(WsEventType.READING_VOICE_ENDED, {
      voiceId: "voice-42",
    });
  });

  it("unsubscribes the voice-ended handler on unmount", () => {
    const orch = makeOrchestrator();
    const unsubMock = vi.fn();
    (orch.setReadingVoiceEndedHandler as ReturnType<typeof vi.fn>).mockReturnValue(
      unsubMock,
    );

    const { unmount } = renderWithOrchestrator(orch);
    unmount();

    expect(unsubMock).toHaveBeenCalled();
  });
});
