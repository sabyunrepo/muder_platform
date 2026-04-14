import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
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
  },
}));

// ---------------------------------------------------------------------------
// Mock: @/services/queryClient
// ---------------------------------------------------------------------------

vi.mock("@/services/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { uploadImage } from "../imageApi";

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
