import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Mocks — stub useConnectionStore.getState() so we can swap gameClient.
// ---------------------------------------------------------------------------

let mockGameClient: { send: ReturnType<typeof vi.fn> } | null = null;

vi.mock("@/stores/connectionStore", () => ({
  useConnectionStore: Object.assign(() => null, {
    getState: () => ({
      gameClient: mockGameClient,
    }),
  }),
}));

import { useReadingAdvance } from "./useReadingAdvance";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useReadingAdvance", () => {
  beforeEach(() => {
    mockGameClient = { send: vi.fn() };
  });

  it("returns a callable function", () => {
    const { result } = renderHook(() => useReadingAdvance());
    expect(typeof result.current).toBe("function");
  });

  it("sends reading:advance with empty payload via gameClient", () => {
    const { result } = renderHook(() => useReadingAdvance());

    result.current();

    expect(mockGameClient!.send).toHaveBeenCalledTimes(1);
    expect(mockGameClient!.send).toHaveBeenCalledWith(
      WsEventType.READING_ADVANCE,
      {},
    );
  });

  it("returns a stable callback identity across rerenders", () => {
    const { result, rerender } = renderHook(() => useReadingAdvance());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("is a no-op when gameClient is null", () => {
    mockGameClient = null;
    const { result } = renderHook(() => useReadingAdvance());

    expect(() => result.current()).not.toThrow();
  });

  it("swallows send errors in dev without throwing", () => {
    mockGameClient = {
      send: vi.fn(() => {
        throw new Error("ws closed");
      }),
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useReadingAdvance());

    expect(() => result.current()).not.toThrow();

    warnSpy.mockRestore();
  });
});
