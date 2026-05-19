import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const invalidateSpy = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock("@/services/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateSpy(...args),
  },
}));

import { api } from "@/services/api";
import { roomKeys, useSetReady, useStartRoom } from "./api";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("lobby pregame mutations", () => {
  it("useSetReady posts is_ready and invalidates room detail/list", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: "ready updated" });
    const { result } = renderHook(() => useSetReady(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ roomId: "room-1", is_ready: true });
    });

    expect(api.post).toHaveBeenCalledWith("/v1/rooms/room-1/ready", {
      is_ready: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.detail("room-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.list(),
    });
  });

  it("useStartRoom posts to start endpoint and invalidates room detail/list", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: "started" });
    const { result } = renderHook(() => useStartRoom(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync("room-1");
    });

    expect(api.post).toHaveBeenCalledWith("/v1/rooms/room-1/start", {});
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.detail("room-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.list(),
    });
  });
});
