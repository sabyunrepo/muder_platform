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
import {
  useReadingStore,
  type ReadingLineWire,
  type ReadingStateSnapshot,
} from "@/stores/readingStore";

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

  it("registers handlers for all audio presentation events", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    expect(handlers.has(WsEventType.AUDIO_SET_BGM)).toBe(true);
    expect(handlers.has(WsEventType.AUDIO_PLAY_VOICE)).toBe(true);
    expect(handlers.has(WsEventType.AUDIO_PLAY_MEDIA)).toBe(true);
    expect(handlers.has(WsEventType.AUDIO_PLAY_SOUND)).toBe(true);
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

  it("routes audio:play_sound → orchestrator.handlePlayMedia", () => {
    const orch = makeOrchestrator();
    renderWithOrchestrator(orch);

    const payload = { mediaId: "s1", url: "sfx.mp3" };
    handlers.get(WsEventType.AUDIO_PLAY_SOUND)!(payload, 1);

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
      handlers.get(WsEventType.AUDIO_PLAY_SOUND)!({ mediaId: "s2" }, 1);
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

  // -------------------------------------------------------------------------
  // Reading events (Phase F3)
  // -------------------------------------------------------------------------

  describe("reading:* events", () => {
    beforeEach(() => {
      // Reset the real readingStore between tests.
      useReadingStore.getState().clear();
    });

    it("registers handlers for all 6 reading:* events", () => {
      renderWithOrchestrator(makeOrchestrator());

      expect(handlers.has(WsEventType.READING_STARTED)).toBe(true);
      expect(handlers.has(WsEventType.READING_LINE_CHANGED)).toBe(true);
      expect(handlers.has(WsEventType.READING_PAUSED)).toBe(true);
      expect(handlers.has(WsEventType.READING_RESUMED)).toBe(true);
      expect(handlers.has(WsEventType.READING_COMPLETED)).toBe(true);
      expect(handlers.has(WsEventType.READING_STATE)).toBe(true);
    });

    it("reading:started → readingStore.startSection", () => {
      renderWithOrchestrator(makeOrchestrator());
      const lines: ReadingLineWire[] = [
        { index: 0, text: "hello", advanceBy: "gm" },
        { index: 1, text: "world", advanceBy: "voice" },
      ];

      handlers.get(WsEventType.READING_STARTED)!(
        { sectionId: "sec-1", lines },
        1,
      );

      const state = useReadingStore.getState();
      expect(state.sectionId).toBe("sec-1");
      expect(state.lines).toEqual(lines);
      expect(state.currentIndex).toBe(0);
      expect(state.status).toBe("playing");
    });

    it("reading:line_changed → readingStore.showLine", () => {
      renderWithOrchestrator(makeOrchestrator());
      // Seed the store with lines so showLine has something to clamp to.
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "a", advanceBy: "gm" },
        { index: 1, text: "b", advanceBy: "gm" },
        { index: 2, text: "c", advanceBy: "gm" },
      ]);

      handlers.get(WsEventType.READING_LINE_CHANGED)!({ lineIndex: 2 }, 1);

      expect(useReadingStore.getState().currentIndex).toBe(2);
    });

    it("reading:paused → readingStore.pauseSection with reason", () => {
      renderWithOrchestrator(makeOrchestrator());
      useReadingStore
        .getState()
        .startSection("sec-1", [
          { index: 0, text: "a", advanceBy: "gm" },
        ]);

      handlers.get(WsEventType.READING_PAUSED)!({ reason: "voice" }, 1);

      const state = useReadingStore.getState();
      expect(state.status).toBe("paused");
      expect(state.pausedReason).toBe("voice");
    });

    it("reading:paused → defaults reason to 'paused' when omitted", () => {
      renderWithOrchestrator(makeOrchestrator());
      useReadingStore
        .getState()
        .startSection("sec-1", [
          { index: 0, text: "a", advanceBy: "gm" },
        ]);

      handlers.get(WsEventType.READING_PAUSED)!({}, 1);

      expect(useReadingStore.getState().pausedReason).toBe("paused");
    });

    it("reading:resumed → readingStore.resumeSection", () => {
      renderWithOrchestrator(makeOrchestrator());
      useReadingStore
        .getState()
        .startSection("sec-1", [
          { index: 0, text: "a", advanceBy: "gm" },
        ]);
      useReadingStore.getState().pauseSection("voice");

      handlers.get(WsEventType.READING_RESUMED)!({}, 1);

      const state = useReadingStore.getState();
      expect(state.status).toBe("playing");
      expect(state.pausedReason).toBe(null);
    });

    it("reading:completed → readingStore.completeSection", () => {
      renderWithOrchestrator(makeOrchestrator());
      useReadingStore
        .getState()
        .startSection("sec-1", [
          { index: 0, text: "a", advanceBy: "gm" },
        ]);

      handlers.get(WsEventType.READING_COMPLETED)!({}, 1);

      expect(useReadingStore.getState().status).toBe("completed");
    });

    it("reading:state → readingStore.restoreFromSnapshot", () => {
      renderWithOrchestrator(makeOrchestrator());
      const snapshot: ReadingStateSnapshot = {
        sectionId: "sec-9",
        lines: [
          { index: 0, text: "x", advanceBy: "gm" },
          { index: 1, text: "y", advanceBy: "voice" },
        ],
        currentIndex: 1,
        status: "paused",
        pausedReason: "voice",
      };

      handlers.get(WsEventType.READING_STATE)!(snapshot, 1);

      const state = useReadingStore.getState();
      expect(state.sectionId).toBe("sec-9");
      expect(state.lines).toEqual(snapshot.lines);
      expect(state.currentIndex).toBe(1);
      expect(state.status).toBe("paused");
      expect(state.pausedReason).toBe("voice");
    });

    it("reading handlers do NOT touch the orchestrator", () => {
      const orch = makeOrchestrator();
      renderWithOrchestrator(orch);

      handlers.get(WsEventType.READING_STARTED)!(
        {
          sectionId: "sec-1",
          lines: [{ index: 0, text: "a", advanceBy: "gm" }],
          bgmMediaId: "bgm-1",
        },
        1,
      );
      handlers.get(WsEventType.READING_LINE_CHANGED)!({ lineIndex: 0 }, 1);
      handlers.get(WsEventType.READING_PAUSED)!({ reason: "voice" }, 1);
      handlers.get(WsEventType.READING_RESUMED)!({}, 1);
      handlers.get(WsEventType.READING_COMPLETED)!({}, 1);

      expect(orch.handleSetBgm).not.toHaveBeenCalled();
      expect(orch.handlePlayVoice).not.toHaveBeenCalled();
      expect(orch.handlePlayMedia).not.toHaveBeenCalled();
      expect(orch.handleStopAll).not.toHaveBeenCalled();
    });
  });
});
