import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPost, mockInvalidateQueries } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: @/services/api
// ---------------------------------------------------------------------------

vi.mock("@/services/api", () => ({
  api: { post: mockPost },
}));

// ---------------------------------------------------------------------------
// Mock: @/features/editor/api (for queryClient invalidation)
// ---------------------------------------------------------------------------

vi.mock("@/features/editor/api", () => ({
  editorKeys: {
    characters: (id: string) => ["editor", "characters", id],
    theme: (id: string) => ["editor", "theme", id],
    clues: (id: string) => ["editor", "clues", id],
  },
}));

// ---------------------------------------------------------------------------
// Mock: @/services/queryClient
// ---------------------------------------------------------------------------

vi.mock("@/services/queryClient", () => ({
  queryClient: { invalidateQueries: mockInvalidateQueries },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { uploadImage, useConfirmImageUpload } from "../imageApi";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("uploadImage", () => {
  const themeId = "theme-uuid-123";
  const targetId = "char-uuid-456";
  const blob = new Blob(["fake"], { type: "image/webp" });

  beforeEach(() => {
    vi.clearAllMocks();
    // fetch mock for S3 PUT
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    mockPost
      .mockResolvedValueOnce({ upload_url: "https://s3/presigned", upload_key: "key-abc" })
      .mockResolvedValueOnce({ image_url: "https://cdn/image.webp" });
  });

  it("sends target_id when target is character and targetId is non-empty", async () => {
    await uploadImage(themeId, "character", targetId, blob, "image/webp");

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      `/v1/editor/themes/${themeId}/images/upload-url`,
      expect.objectContaining({ target_id: targetId }),
    );
  });

  it("omits target_id when target is character and targetId is empty string", async () => {
    await uploadImage(themeId, "character", "", blob, "image/webp");

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("target_id");
  });

  it("omits target_id when target is cover regardless of targetId", async () => {
    await uploadImage(themeId, "cover", themeId, blob, "image/webp");

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("target_id");
  });

  it("returns the image_url from confirm response", async () => {
    const url = await uploadImage(themeId, "character", targetId, blob, "image/webp");
    expect(url).toBe("https://cdn/image.webp");
  });
});

// ---------------------------------------------------------------------------
// useConfirmImageUpload — cache invalidation
// ---------------------------------------------------------------------------

describe("useConfirmImageUpload", () => {
  const themeId = "theme-uuid-123";

  function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient();
    return React.createElement(QueryClientProvider, { client: qc }, children);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ image_url: "https://cdn/image.webp" });
  });

  it("invalidates characters, theme, and clues caches on success", async () => {
    const { result } = renderHook(() => useConfirmImageUpload(themeId), { wrapper });

    await result.current.mutateAsync({ upload_key: "key-abc" });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["editor", "characters", themeId],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["editor", "theme", themeId],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["editor", "clues", themeId],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
  });
});
