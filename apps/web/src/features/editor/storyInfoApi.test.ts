import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    deleteVoid: vi.fn(),
  },
}));

const invalidateSpy = vi.fn();
vi.mock("@/services/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateSpy(...args),
  },
}));

import { api } from "@/services/api";
import { editorKeys } from "./api";
import {
  storyInfoKeys,
  useCreateStoryInfo,
  useDeleteStoryInfo,
  useStoryInfos,
  useUpdateStoryInfo,
  type StoryInfoResponse,
} from "./storyInfoApi";

const THEME_ID = "theme-1";

const mockInfo: StoryInfoResponse = {
  id: "info-1",
  themeId: THEME_ID,
  title: "피해자의 비밀",
  body: "모두에게 공개할 정보",
  imageMediaId: "image-1",
  relatedCharacterIds: ["char-1"],
  relatedClueIds: ["clue-1"],
  relatedLocationIds: ["loc-1"],
  sortOrder: 0,
  version: 1,
  createdAt: "2026-05-06T00:00:00Z",
  updatedAt: "2026-05-06T00:00:00Z",
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe("storyInfoKeys", () => {
  it("uses editor-scoped theme key", () => {
    expect(storyInfoKeys.list(THEME_ID)).toEqual(editorKeys.storyInfos(THEME_ID));
  });
});

describe("useStoryInfos", () => {
  it("fetches story infos for a theme", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockInfo]);

    const { result } = renderHook(() => useStoryInfos(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockInfo]);
    expect(api.get).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/story-infos`,
    );
  });

  it("does not fetch when themeId is empty", () => {
    renderHook(() => useStoryInfos(""), { wrapper: makeWrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("story info mutations", () => {
  it("creates an info card and invalidates the theme list", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockInfo);

    const { result } = renderHook(() => useCreateStoryInfo(THEME_ID), {
      wrapper: makeWrapper(),
    });
    const body = {
      title: "새 정보",
      body: "",
      imageMediaId: null,
      relatedCharacterIds: [],
      relatedClueIds: [],
      relatedLocationIds: [],
      sortOrder: 1,
    };

    await result.current.mutateAsync(body);

    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/story-infos`,
      body,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: storyInfoKeys.list(THEME_ID),
    });
  });

  it("updates with version and supports clearing imageMediaId", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ ...mockInfo, imageMediaId: null });

    const { result } = renderHook(() => useUpdateStoryInfo(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "info-1",
      patch: { version: 1, imageMediaId: null, title: "수정" },
    });

    expect(api.patch).toHaveBeenCalledWith("/v1/editor/story-infos/info-1", {
      version: 1,
      imageMediaId: null,
      title: "수정",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: storyInfoKeys.list(THEME_ID),
    });
  });

  it("deletes a story info and invalidates the theme list", async () => {
    vi.mocked(api.deleteVoid).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteStoryInfo(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync("info-1");

    expect(api.deleteVoid).toHaveBeenCalledWith("/v1/editor/story-infos/info-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: storyInfoKeys.list(THEME_ID),
    });
  });
});
