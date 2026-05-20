import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVoiceConnection } from "@/hooks/useVoiceConnection";
import { voiceApi } from "@/services/voiceApi";
import { useVoiceStore } from "@/stores/voiceStore";

const roomConnectMock = vi.fn();
const roomDisconnectMock = vi.fn();
const roomOnMock = vi.fn();

vi.mock("livekit-client", () => ({
  RoomEvent: {
    Connected: "connected",
    Disconnected: "disconnected",
    Reconnecting: "reconnecting",
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
  },
  Room: vi.fn().mockImplementation(() => ({
    connect: roomConnectMock,
    disconnect: roomDisconnectMock,
    on: roomOnMock,
    remoteParticipants: new Map(),
    localParticipant: { setMicrophoneEnabled: vi.fn() },
  })),
}));

vi.mock("@/services/voiceApi", () => ({
  voiceApi: {
    getTokenForTarget: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useVoiceStore.getState().reset();
});

describe("useVoiceConnection", () => {
  it("does not connect a stale manual connection after disconnect cleanup", async () => {
    const token = deferred<{
      token: string;
      room_name: string;
      livekit_url: string;
    }>();
    vi.mocked(voiceApi.getTokenForTarget).mockReturnValue(token.promise);

    const { result } = renderHook(() =>
      useVoiceConnection({
        roomId: "room-1",
        roomType: "main",
        autoConnect: false,
      }),
    );

    void act(() => {
      void result.current.connect();
    });

    expect(useVoiceStore.getState().connectionState).toBe("connecting");

    await act(async () => {
      await result.current.disconnect();
    });

    await act(async () => {
      token.resolve({
        token: "late-token",
        room_name: "room-room-1-main",
        livekit_url: "ws://livekit",
      });
      await token.promise;
    });

    await waitFor(() => {
      expect(roomConnectMock).not.toHaveBeenCalled();
    });
    expect(useVoiceStore.getState().connectionState).toBe("disconnected");
  });
});
