import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: { post: mockPost, get: vi.fn(), put: vi.fn(), deleteVoid: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Shared queryClient — real TanStack Query instance so cache reads work.
// ---------------------------------------------------------------------------

let testQueryClient: QueryClient;

vi.mock("@/services/queryClient", () => ({
  get queryClient() {
    return testQueryClient;
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useCreateClue, mergeClueImage } from "../editorClueApi";
import { editorKeys } from "../api";
import type { ClueResponse } from "../api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClue(overrides: Partial<ClueResponse> = {}): ClueResponse {
  return {
    id: "clue-1",
    theme_id: "theme-1",
    location_id: null,
    name: "Test Clue",
    description: null,
    image_url: null,
    is_common: false,
    level: 1,
    clue_type: "normal",
    sort_order: 0,
    created_at: "2026-04-15T00:00:00Z",
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client: testQueryClient },
    children,
  );
}

// ---------------------------------------------------------------------------
// Tests: useCreateClue optimistic update
// ---------------------------------------------------------------------------

describe("useCreateClue", () => {
  const themeId = "theme-1";

  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("appends the new clue optimistically to the clues cache on success", async () => {
    const existing = makeClue({ id: "existing-1", name: "Old" });
    testQueryClient.setQueryData(editorKeys.clues(themeId), [existing]);

    const created = makeClue({ id: "new-1", name: "Fresh" });
    mockPost.mockResolvedValue(created);

    const { result } = renderHook(() => useCreateClue(themeId), { wrapper });
    await result.current.mutateAsync({ name: "Fresh" });

    await waitFor(() => {
      const cached = testQueryClient.getQueryData<ClueResponse[]>(
        editorKeys.clues(themeId),
      );
      expect(cached).toBeDefined();
      expect(cached).toHaveLength(2);
      expect(cached?.[1]).toMatchObject({ id: "new-1", name: "Fresh" });
    });
  });

  it("seeds the clues cache when it was previously empty", async () => {
    const created = makeClue({ id: "new-1", name: "First" });
    mockPost.mockResolvedValue(created);

    const { result } = renderHook(() => useCreateClue(themeId), { wrapper });
    await result.current.mutateAsync({ name: "First" });

    await waitFor(() => {
      const cached = testQueryClient.getQueryData<ClueResponse[]>(
        editorKeys.clues(themeId),
      );
      expect(cached).toEqual([created]);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: mergeClueImage helper
// ---------------------------------------------------------------------------

describe("mergeClueImage", () => {
  const themeId = "theme-1";

  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient();
  });

  it("merges image_url onto the matching clue and leaves others intact", () => {
    const a = makeClue({ id: "a", image_url: null });
    const b = makeClue({ id: "b", image_url: "old.png" });
    testQueryClient.setQueryData(editorKeys.clues(themeId), [a, b]);

    mergeClueImage(themeId, "a", "https://cdn/new.png");

    const cached = testQueryClient.getQueryData<ClueResponse[]>(
      editorKeys.clues(themeId),
    );
    expect(cached?.find((c) => c.id === "a")?.image_url).toBe(
      "https://cdn/new.png",
    );
    expect(cached?.find((c) => c.id === "b")?.image_url).toBe("old.png");
  });

  it("is a no-op when no clues cache exists", () => {
    expect(() =>
      mergeClueImage(themeId, "a", "https://cdn/new.png"),
    ).not.toThrow();
    expect(
      testQueryClient.getQueryData(editorKeys.clues(themeId)),
    ).toBeUndefined();
  });
});
