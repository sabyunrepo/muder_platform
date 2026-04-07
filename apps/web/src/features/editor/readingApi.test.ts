import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// Imports must come after mocks above.
import { api } from "@/services/api";
import {
  buildUpdateBody,
  isValidAdvanceBy,
  readingKeys,
  useCreateReadingSection,
  useDeleteReadingSection,
  useReadingSections,
  useUpdateReadingSection,
  type ReadingSectionResponse,
} from "./readingApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THEME_ID = "theme-1";

const mockSection: ReadingSectionResponse = {
  id: "section-1",
  themeId: THEME_ID,
  name: "Prologue",
  bgmMediaId: "bgm-1",
  lines: [
    {
      Index: 0,
      Text: "It was a dark and stormy night.",
      Speaker: "Narrator",
      VoiceMediaID: "voice-1",
      AdvanceBy: "voice",
    },
  ],
  sortOrder: 0,
  version: 1,
  createdAt: "2026-04-07T00:00:00Z",
  updatedAt: "2026-04-07T00:00:00Z",
};

const mockSection2: ReadingSectionResponse = {
  ...mockSection,
  id: "section-2",
  name: "Chapter 1",
  sortOrder: 1,
  bgmMediaId: null,
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

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

describe("readingKeys", () => {
  it("scopes list key by themeId", () => {
    expect(readingKeys.list(THEME_ID)).toEqual(["reading-sections", THEME_ID]);
  });
});

// ---------------------------------------------------------------------------
// isValidAdvanceBy
// ---------------------------------------------------------------------------

describe("isValidAdvanceBy", () => {
  it("accepts empty string", () => {
    expect(isValidAdvanceBy("")).toBe(true);
  });

  it("accepts 'voice'", () => {
    expect(isValidAdvanceBy("voice")).toBe(true);
  });

  it("accepts 'gm'", () => {
    expect(isValidAdvanceBy("gm")).toBe(true);
  });

  it("accepts 'role:<id>' with non-empty id", () => {
    expect(isValidAdvanceBy("role:detective")).toBe(true);
    expect(isValidAdvanceBy("role:a")).toBe(true);
  });

  it("rejects bare 'role:' without id", () => {
    expect(isValidAdvanceBy("role:")).toBe(false);
  });

  it("rejects unknown values", () => {
    expect(isValidAdvanceBy("auto")).toBe(false);
    expect(isValidAdvanceBy("VOICE")).toBe(false);
    expect(isValidAdvanceBy("GM")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildUpdateBody (triple-state bgmMediaId)
// ---------------------------------------------------------------------------

describe("buildUpdateBody", () => {
  it("strips undefined keys (omit = keep current)", () => {
    const body = buildUpdateBody({ version: 1, bgmMediaId: undefined });
    expect(body).toEqual({ version: 1 });
    expect("bgmMediaId" in body).toBe(false);
  });

  it("preserves null (clear)", () => {
    const body = buildUpdateBody({ version: 1, bgmMediaId: null });
    expect(body).toEqual({ version: 1, bgmMediaId: null });
    expect(JSON.stringify(body)).toContain('"bgmMediaId":null');
  });

  it("preserves string (set)", () => {
    const body = buildUpdateBody({ version: 1, bgmMediaId: "bgm-2" });
    expect(body).toEqual({ version: 1, bgmMediaId: "bgm-2" });
  });

  it("retains other patch fields", () => {
    const body = buildUpdateBody({
      version: 3,
      name: "renamed",
      sortOrder: 5,
      lines: [{ Index: 0, Text: "hi" }],
    });
    expect(body).toEqual({
      version: 3,
      name: "renamed",
      sortOrder: 5,
      lines: [{ Index: 0, Text: "hi" }],
    });
  });
});

// ---------------------------------------------------------------------------
// useReadingSections
// ---------------------------------------------------------------------------

describe("useReadingSections", () => {
  it("fetches sections and returns the list as-is", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockSection, mockSection2]);

    const { result } = renderHook(() => useReadingSections(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockSection, mockSection2]);
    expect(api.get).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/reading-sections`,
    );
  });

  it("does not fetch when themeId is empty", () => {
    renderHook(() => useReadingSections(""), { wrapper: makeWrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useCreateReadingSection
// ---------------------------------------------------------------------------

describe("useCreateReadingSection", () => {
  it("POSTs the request body and invalidates the list", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockSection);

    const { result } = renderHook(() => useCreateReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    const body = {
      name: "Prologue",
      bgmMediaId: "bgm-1",
      sortOrder: 0,
      lines: [
        {
          Index: 0,
          Text: "It was a dark and stormy night.",
          Speaker: "Narrator",
          VoiceMediaID: "voice-1",
          AdvanceBy: "voice" as const,
        },
      ],
    };
    const resp = await result.current.mutateAsync(body);

    expect(resp).toEqual(mockSection);
    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/reading-sections`,
      body,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: readingKeys.list(THEME_ID),
    });
  });
});

// ---------------------------------------------------------------------------
// useUpdateReadingSection
// ---------------------------------------------------------------------------

describe("useUpdateReadingSection", () => {
  it("PATCHes with version and invalidates list", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(mockSection);

    const { result } = renderHook(() => useUpdateReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "section-1",
      patch: { version: 1, name: "renamed" },
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/v1/editor/reading-sections/section-1",
      { version: 1, name: "renamed" },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: readingKeys.list(THEME_ID),
    });
  });

  it("triple-state bgmMediaId: undefined preserves (omitted from body)", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(mockSection);

    const { result } = renderHook(() => useUpdateReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "section-1",
      patch: { version: 1, bgmMediaId: undefined },
    });

    const sentBody = vi.mocked(api.patch).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect("bgmMediaId" in sentBody).toBe(false);
    expect(sentBody).toEqual({ version: 1 });
  });

  it("triple-state bgmMediaId: null clears (preserved as JSON null)", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(mockSection);

    const { result } = renderHook(() => useUpdateReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "section-1",
      patch: { version: 2, bgmMediaId: null },
    });

    const sentBody = vi.mocked(api.patch).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(sentBody).toEqual({ version: 2, bgmMediaId: null });
    expect(JSON.stringify(sentBody)).toContain('"bgmMediaId":null');
  });

  it("triple-state bgmMediaId: string sets to that id", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(mockSection);

    const { result } = renderHook(() => useUpdateReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "section-1",
      patch: { version: 3, bgmMediaId: "bgm-99" },
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/v1/editor/reading-sections/section-1",
      { version: 3, bgmMediaId: "bgm-99" },
    );
  });

  it("surfaces 409 version conflict errors", async () => {
    const err = Object.assign(new Error("version conflict"), {
      status: 409,
      code: "READING_SECTION_VERSION_CONFLICT",
    });
    vi.mocked(api.patch).mockRejectedValueOnce(err);

    const { result } = renderHook(() => useUpdateReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        id: "section-1",
        patch: { version: 1, name: "x" },
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "READING_SECTION_VERSION_CONFLICT",
    });
    // Invalidation should NOT fire on error.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useDeleteReadingSection
// ---------------------------------------------------------------------------

describe("useDeleteReadingSection", () => {
  it("DELETEs and invalidates list", async () => {
    vi.mocked(api.deleteVoid).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync("section-1");

    expect(api.deleteVoid).toHaveBeenCalledWith(
      "/v1/editor/reading-sections/section-1",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: readingKeys.list(THEME_ID),
    });
  });

  it("surfaces 409 conflict errors and skips invalidation", async () => {
    const err = Object.assign(new Error("conflict"), {
      status: 409,
      code: "READING_SECTION_VERSION_CONFLICT",
    });
    vi.mocked(api.deleteVoid).mockRejectedValueOnce(err);

    const { result } = renderHook(() => useDeleteReadingSection(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync("section-1"),
    ).rejects.toMatchObject({ status: 409 });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
