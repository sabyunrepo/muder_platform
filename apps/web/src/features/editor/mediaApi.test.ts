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
  mediaKeys,
  uploadMediaFile,
  useConfirmUpload,
  useConfirmReplacementUpload,
  useCreateMediaCategory,
  useCreateYouTubeMedia,
  useDeleteMediaCategory,
  useDeleteMedia,
  useMediaCategories,
  useMediaDownloadUrl,
  useMediaList,
  useMediaDeletePreview,
  useRequestReplacementUpload,
  useRequestUploadUrl,
  useUpdateMediaCategory,
  useUpdateMedia,
  type MediaCategoryResponse,
  type MediaResponse,
  type UploadUrlResponse,
} from "./mediaApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THEME_ID = "theme-1";

const mockMedia: MediaResponse = {
  id: "media-1",
  theme_id: THEME_ID,
  name: "test.mp3",
  type: "BGM",
  source_type: "FILE",
  url: "https://r2.example.com/test.mp3",
  duration: 120,
  file_size: 1024,
  mime_type: "audio/mpeg",
  tags: [],
  sort_order: 0,
  created_at: "2026-04-07T00:00:00Z",
};

const mockUploadUrl: UploadUrlResponse = {
  upload_id: "upload-1",
  upload_url: "https://r2.example.com/upload",
  expires_at: "2026-04-07T01:00:00Z",
};

const mockCategory: MediaCategoryResponse = {
  id: "category-1",
  theme_id: THEME_ID,
  name: "배경",
  sort_order: 1,
  created_at: "2026-04-07T00:00:00Z",
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

describe("mediaKeys", () => {
  it("includes type in list key when provided", () => {
    expect(mediaKeys.list(THEME_ID, "BGM")).toEqual([
      "media",
      THEME_ID,
      "BGM",
      "all-categories",
    ]);
  });

  it("uses 'all' as type fallback", () => {
    expect(mediaKeys.list(THEME_ID)).toEqual([
      "media",
      THEME_ID,
      "all",
      "all-categories",
    ]);
  });

  it("includes category in list key when provided", () => {
    expect(mediaKeys.list(THEME_ID, "IMAGE", "category-1")).toEqual([
      "media",
      THEME_ID,
      "IMAGE",
      "category-1",
    ]);
  });
});

// ---------------------------------------------------------------------------
// useMediaList
// ---------------------------------------------------------------------------

describe("useMediaList", () => {
  it("fetches media list and returns data", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockMedia]);

    const { result } = renderHook(() => useMediaList(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockMedia]);
    expect(api.get).toHaveBeenCalledWith(`/v1/editor/themes/${THEME_ID}/media`);
  });

  it("respects type filter in query string", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderHook(() => useMediaList(THEME_ID, "BGM"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        `/v1/editor/themes/${THEME_ID}/media?type=BGM`,
      ),
    );
  });

  it("respects category filter in query string", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderHook(() => useMediaList(THEME_ID, "IMAGE", "category-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        `/v1/editor/themes/${THEME_ID}/media?type=IMAGE&category_id=category-1`,
      ),
    );
  });
});

describe("useMediaCategories", () => {
  it("fetches media categories for a theme", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockCategory]);

    const { result } = renderHook(() => useMediaCategories(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/media/categories`,
    );
    expect(result.current.data).toEqual([mockCategory]);
  });
});

describe("useMediaDeletePreview", () => {
  it("fetches media references when media id is present", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      references: [{ type: "map", id: "map-1", name: "1층 지도" }],
    });

    const { result } = renderHook(() => useMediaDeletePreview("media-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/v1/editor/media/media-1/references");
    expect(result.current.data?.references[0]?.type).toBe("map");
  });

  it("does not fetch media references without media id", () => {
    renderHook(() => useMediaDeletePreview(undefined), {
      wrapper: makeWrapper(),
    });

    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("useMediaDownloadUrl", () => {
  it("fetches editor media download URL when media id is present", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      url: "https://download.example/role.pdf",
      expires_at: "2026-05-02T00:10:00Z",
    });

    const { result } = renderHook(() => useMediaDownloadUrl("media-pdf-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/v1/editor/media/media-pdf-1/download-url");
    expect(result.current.data?.url).toBe("https://download.example/role.pdf");
  });

  it("does not fetch download URL without media id", () => {
    renderHook(() => useMediaDownloadUrl(undefined), {
      wrapper: makeWrapper(),
    });

    expect(api.get).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mutations — POST/PATCH/DELETE bodies + invalidation
// ---------------------------------------------------------------------------

describe("useRequestUploadUrl", () => {
  it("POSTs the request body to the upload-url endpoint", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockUploadUrl);

    const { result } = renderHook(() => useRequestUploadUrl(THEME_ID), {
      wrapper: makeWrapper(),
    });

    const body = {
      name: "test.mp3",
      type: "BGM" as const,
      mime_type: "audio/mpeg",
      file_size: 1024,
    };
    const resp = await result.current.mutateAsync(body);

    expect(resp).toEqual(mockUploadUrl);
    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/media/upload-url`,
      body,
    );
  });

  it("keeps category id in the upload-url request body", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockUploadUrl);

    const { result } = renderHook(() => useRequestUploadUrl(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      name: "map.png",
      type: "IMAGE",
      mime_type: "image/png",
      file_size: 2048,
      category_id: "category-1",
    });

    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/media/upload-url`,
      {
        name: "map.png",
        type: "IMAGE",
        mime_type: "image/png",
        file_size: 2048,
        category_id: "category-1",
      },
    );
  });
});

describe("useConfirmUpload", () => {
  it("invalidates the media list on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockMedia);

    const { result } = renderHook(() => useConfirmUpload(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ upload_id: "upload-1" });

    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/media/confirm`,
      { upload_id: "upload-1" },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
  });
});

describe("useCreateYouTubeMedia", () => {
  it("invalidates list after creation", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockMedia);

    const { result } = renderHook(() => useCreateYouTubeMedia(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      name: "song",
      type: "BGM",
      url: "https://www.youtube.com/watch?v=abc",
    });

    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/media/youtube`,
      {
        name: "song",
        type: "BGM",
        url: "https://www.youtube.com/watch?v=abc",
      },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
  });
});

describe("useUpdateMedia", () => {
  it("PATCHes media and invalidates list", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(mockMedia);

    const { result } = renderHook(() => useUpdateMedia(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "media-1",
      patch: { name: "new", type: "BGM", sort_order: 1 },
    });

    expect(api.patch).toHaveBeenCalledWith("/v1/editor/media/media-1", {
      name: "new",
      type: "BGM",
      sort_order: 1,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
  });
});

describe("useDeleteMedia", () => {
  it("DELETEs and invalidates list", async () => {
    vi.mocked(api.deleteVoid).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteMedia(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync("media-1");

    expect(api.deleteVoid).toHaveBeenCalledWith("/v1/editor/media/media-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
  });

  it("surfaces 409 reference-in-use errors", async () => {
    const err = Object.assign(new Error("media in use"), {
      status: 409,
      code: "MEDIA_REFERENCE_IN_USE",
    });
    vi.mocked(api.deleteVoid).mockRejectedValueOnce(err);

    const { result } = renderHook(() => useDeleteMedia(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await expect(result.current.mutateAsync("media-1")).rejects.toMatchObject({
      status: 409,
      code: "MEDIA_REFERENCE_IN_USE",
    });
    // Invalidation should NOT fire on error.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("media category mutations", () => {
  it("creates a category and invalidates category list", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockCategory);

    const { result } = renderHook(() => useCreateMediaCategory(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ name: "배경", sort_order: 1 });

    expect(api.post).toHaveBeenCalledWith(
      `/v1/editor/themes/${THEME_ID}/media/categories`,
      { name: "배경", sort_order: 1 },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.categories(THEME_ID),
    });
  });

  it("updates a category and invalidates categories plus media list", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(mockCategory);

    const { result } = renderHook(() => useUpdateMediaCategory(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      id: "category-1",
      patch: { name: "배경", sort_order: 2 },
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/v1/editor/media/categories/category-1",
      { name: "배경", sort_order: 2 },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.categories(THEME_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
  });

  it("deletes a category and invalidates categories plus media list", async () => {
    vi.mocked(api.deleteVoid).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteMediaCategory(THEME_ID), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync("category-1");

    expect(api.deleteVoid).toHaveBeenCalledWith(
      "/v1/editor/media/categories/category-1",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.categories(THEME_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
  });
});

describe("replacement upload mutations", () => {
  it("requests a replacement upload URL for an existing media item", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockUploadUrl);

    const { result } = renderHook(() => useRequestReplacementUpload("media-1"), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      mime_type: "image/png",
      file_size: 2048,
    });

    expect(api.post).toHaveBeenCalledWith(
      "/v1/editor/media/media-1/replace-upload-url",
      { mime_type: "image/png", file_size: 2048 },
    );
  });

  it("confirms replacement upload and invalidates media plus download URL", async () => {
    vi.mocked(api.post).mockResolvedValueOnce(mockMedia);

    const { result } = renderHook(
      () => useConfirmReplacementUpload(THEME_ID, "media-1"),
      { wrapper: makeWrapper() },
    );

    await result.current.mutateAsync({ upload_id: "upload-1" });

    expect(api.post).toHaveBeenCalledWith(
      "/v1/editor/media/media-1/replace-confirm",
      { upload_id: "upload-1" },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.byTheme(THEME_ID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mediaKeys.downloadUrl("media-1"),
    });
  });
});

// ---------------------------------------------------------------------------
// uploadMediaFile helper
// ---------------------------------------------------------------------------

describe("uploadMediaFile", () => {
  const file = new File(["audio-bytes"], "song.mp3", { type: "audio/mpeg" });

  it("performs request → PUT → confirm and returns the final media", async () => {
    const requestUploadUrl = vi.fn().mockResolvedValue(mockUploadUrl);
    const confirmUpload = vi.fn().mockResolvedValue(mockMedia);
    const putFile = vi.fn().mockResolvedValue(undefined);

    const result = await uploadMediaFile({
      themeId: THEME_ID,
      file,
      type: "BGM",
      name: "song",
      requestUploadUrl,
      confirmUpload,
      putFile,
    });

    expect(requestUploadUrl).toHaveBeenCalledWith({
      name: "song",
      type: "BGM",
      mime_type: "audio/mpeg",
      file_size: file.size,
      category_id: undefined,
    });
    expect(putFile).toHaveBeenCalledTimes(1);
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: mockUploadUrl.upload_url,
        file,
        contentType: "audio/mpeg",
      }),
    );
    expect(confirmUpload).toHaveBeenCalledWith({ upload_id: "upload-1" });
    expect(result).toEqual(mockMedia);
  });

  it("uses the same MIME override for presign and PUT when file.type is empty", async () => {
    const pdf = new File(["%PDF-1.4"], "role.pdf", { type: "" });
    const requestUploadUrl = vi.fn().mockResolvedValue(mockUploadUrl);
    const confirmUpload = vi.fn().mockResolvedValue({
      ...mockMedia,
      type: "DOCUMENT",
      mime_type: "application/pdf",
    });
    const putFile = vi.fn().mockResolvedValue(undefined);

    await uploadMediaFile({
      themeId: THEME_ID,
      file: pdf,
      type: "DOCUMENT",
      name: "role",
      mimeType: "application/pdf",
      requestUploadUrl,
      confirmUpload,
      putFile,
    });

    expect(requestUploadUrl).toHaveBeenCalledWith({
      name: "role",
      type: "DOCUMENT",
      mime_type: "application/pdf",
      file_size: pdf.size,
      category_id: undefined,
    });
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file: pdf,
        contentType: "application/pdf",
      }),
    );
  });

  it("retries the PUT step up to maxAttempts on failure (3x)", async () => {
    const requestUploadUrl = vi.fn().mockResolvedValue(mockUploadUrl);
    const confirmUpload = vi.fn().mockResolvedValue(mockMedia);
    const putFile = vi
      .fn()
      .mockRejectedValueOnce(new Error("net1"))
      .mockRejectedValueOnce(new Error("net2"))
      .mockResolvedValueOnce(undefined);

    const result = await uploadMediaFile({
      themeId: THEME_ID,
      file,
      type: "BGM",
      name: "song",
      requestUploadUrl,
      confirmUpload,
      putFile,
      retryBaseDelayMs: 0,
    });

    expect(putFile).toHaveBeenCalledTimes(3);
    expect(confirmUpload).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockMedia);
  });

  it("fails after exhausting all PUT retry attempts", async () => {
    const requestUploadUrl = vi.fn().mockResolvedValue(mockUploadUrl);
    const confirmUpload = vi.fn().mockResolvedValue(mockMedia);
    const putFile = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      uploadMediaFile({
        themeId: THEME_ID,
        file,
        type: "BGM",
        name: "song",
        requestUploadUrl,
        confirmUpload,
        putFile,
        retryBaseDelayMs: 0,
      }),
    ).rejects.toThrow("network down");

    expect(putFile).toHaveBeenCalledTimes(3);
    expect(confirmUpload).not.toHaveBeenCalled();
  });

  it("reports progress via the onProgress callback", async () => {
    const onProgress = vi.fn();
    const requestUploadUrl = vi.fn().mockResolvedValue(mockUploadUrl);
    const confirmUpload = vi.fn().mockResolvedValue(mockMedia);
    const putFile = vi.fn(async (params) => {
      params.onProgress?.(25);
      params.onProgress?.(75);
      params.onProgress?.(100);
    });

    await uploadMediaFile({
      themeId: THEME_ID,
      file,
      type: "BGM",
      name: "song",
      requestUploadUrl,
      confirmUpload,
      putFile,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(25);
    expect(onProgress).toHaveBeenCalledWith(75);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("passes category id through the upload helper request", async () => {
    const requestUploadUrl = vi.fn().mockResolvedValue(mockUploadUrl);
    const confirmUpload = vi.fn().mockResolvedValue(mockMedia);
    const putFile = vi.fn().mockResolvedValue(undefined);

    await uploadMediaFile({
      themeId: THEME_ID,
      file,
      type: "IMAGE",
      name: "map",
      categoryId: "category-1",
      requestUploadUrl,
      confirmUpload,
      putFile,
      retryBaseDelayMs: 0,
    });

    expect(requestUploadUrl).toHaveBeenCalledWith({
      name: "map",
      type: "IMAGE",
      mime_type: "audio/mpeg",
      file_size: file.size,
      category_id: "category-1",
    });
  });
});
