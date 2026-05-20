import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVoiceConnection } from "@/hooks/useVoiceConnection";
import { voiceApi } from "@/services/voiceApi";
import { useVoiceStore } from "@/stores/voiceStore";

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
  it("does not expose stale LiveKit connection details after disconnect cleanup", async () => {
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
      expect(result.current.connectionDetails).toBeNull();
    });
    expect(useVoiceStore.getState().connectionState).toBe("disconnected");
  });

  it("keeps token fetching separate from LiveKit connected state", async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: "token-1",
      room_name: "room-room-1-main",
      livekit_url: "ws://livekit",
    });

    const { result } = renderHook(() =>
      useVoiceConnection({
        roomId: "room-1",
        roomType: "main",
        autoConnect: false,
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connectionDetails).toEqual({
      token: "token-1",
      roomName: "room-room-1-main",
      serverUrl: "ws://livekit",
    });
    expect(useVoiceStore.getState().connectionState).toBe("connecting");

    act(() => {
      result.current.handleConnected();
    });

    expect(useVoiceStore.getState().connectionState).toBe("connected");
    expect(useVoiceStore.getState().currentChannel).toBe("room-room-1-main");
  });

  it("sets error state when voice token request fails", async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockRejectedValue(new Error("token denied"));

    const { result } = renderHook(() =>
      useVoiceConnection({
        roomId: "room-1",
        roomType: "main",
        autoConnect: false,
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connectionDetails).toBeNull();
    expect(useVoiceStore.getState().connectionState).toBe("error");
    expect(useVoiceStore.getState().currentChannel).toBeNull();
  });

  it("ignores stale LiveKit callbacks after a user disconnect", async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: "token-1",
      room_name: "room-room-1-main",
      livekit_url: "ws://livekit",
    });

    const { result } = renderHook(() =>
      useVoiceConnection({
        roomId: "room-1",
        roomType: "main",
        autoConnect: false,
      }),
    );

    await act(async () => {
      await result.current.connect();
      await result.current.disconnect();
    });

    act(() => {
      result.current.handleConnected();
      result.current.handleError(new Error("late failure"));
    });

    expect(result.current.connectionDetails).toBeNull();
    expect(useVoiceStore.getState().connectionState).toBe("disconnected");
    expect(useVoiceStore.getState().currentChannel).toBeNull();
  });

  it("clears LiveKit connection details when the room disconnects", async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: "token-1",
      room_name: "room-room-1-main",
      livekit_url: "ws://livekit",
    });

    const { result } = renderHook(() =>
      useVoiceConnection({
        roomId: "room-1",
        roomType: "main",
        autoConnect: false,
      }),
    );

    await act(async () => {
      await result.current.connect();
    });

    act(() => {
      result.current.handleConnected();
    });

    expect(useVoiceStore.getState().connectionState).toBe("connected");

    act(() => {
      result.current.handleDisconnected();
    });

    expect(result.current.connectionDetails).toBeNull();
    expect(useVoiceStore.getState().connectionState).toBe("disconnected");
    expect(useVoiceStore.getState().currentChannel).toBeNull();
  });
});
