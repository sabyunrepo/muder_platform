import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types — match backend snake_case JSON exactly
// ---------------------------------------------------------------------------

export type MediaType = "BGM" | "SFX" | "VOICE" | "VIDEO" | "DOCUMENT" | "IMAGE";
export type MediaSourceType = "FILE" | "YOUTUBE";

export interface MediaResponse {
  id: string;
  theme_id: string;
  name: string;
  type: MediaType;
  source_type: MediaSourceType;
  url?: string;
  duration?: number;
  file_size?: number;
  mime_type?: string;
  tags: string[];
  sort_order: number;
  category_id?: string;
  created_at: string;
}

export interface RequestUploadUrlRequest {
  name: string;
  type: MediaType;
  mime_type: string;
  file_size: number;
  category_id?: string;
}

export interface UploadUrlResponse {
  upload_id: string;
  upload_url: string;
  expires_at: string;
}

export interface MediaDownloadUrlResponse {
  url: string;
  expires_at: string;
}

export interface ConfirmUploadRequest {
  upload_id: string;
}

export interface CreateYouTubeMediaRequest {
  name: string;
  type: MediaType;
  url: string;
  category_id?: string;
}

/**
 * Backend `UpdateMediaRequest` requires name, type, sort_order on every call
 * (validate:"required"). Tags + duration are optional.
 */
export interface UpdateMediaRequest {
  name: string;
  type: MediaType;
  sort_order: number;
  duration?: number;
  tags?: string[];
  category_id?: string;
}

export interface MediaCategoryResponse {
  id: string;
  theme_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MediaCategoryRequest {
  name: string;
  sort_order: number;
}

export interface MediaDeletePreviewResponse {
  references: MediaReferenceInfo[];
}

export interface RequestReplacementUploadRequest {
  mime_type: string;
  file_size: number;
}

// Reference info returned in 409 problem-details `params.references`.
// Backend shape: { type, id, name } — e.g. { type: "reading_section", id: "...", name: "..." }
export interface MediaReferenceInfo {
  type: string;
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const mediaKeys = {
  all: ["media"] as const,
  list: (themeId: string, type?: MediaType, categoryId?: string) =>
    ["media", themeId, type ?? "all", categoryId ?? "all-categories"] as const,
  byTheme: (themeId: string) => ["media", themeId] as const,
  categories: (themeId: string) => ["media", themeId, "categories"] as const,
  references: (mediaId: string) => ["media", mediaId, "references"] as const,
  downloadUrl: (mediaId: string) => ["media", mediaId, "download-url"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMediaList(themeId: string, type?: MediaType, categoryId?: string) {
  return useQuery<MediaResponse[]>({
    queryKey: mediaKeys.list(themeId, type, categoryId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (categoryId) params.set("category_id", categoryId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return api.get<MediaResponse[]>(
        `/v1/editor/themes/${themeId}/media${qs}`,
      );
    },
    enabled: !!themeId,
  });
}

export function useMediaCategories(themeId: string) {
  return useQuery<MediaCategoryResponse[]>({
    queryKey: mediaKeys.categories(themeId),
    queryFn: () =>
      api.get<MediaCategoryResponse[]>(
        `/v1/editor/themes/${themeId}/media/categories`,
      ),
    enabled: !!themeId,
  });
}

export function useMediaDeletePreview(mediaId?: string) {
  return useQuery<MediaDeletePreviewResponse>({
    queryKey: mediaKeys.references(mediaId ?? ""),
    queryFn: () =>
      api.get<MediaDeletePreviewResponse>(`/v1/editor/media/${mediaId}/references`),
    enabled: !!mediaId,
  });
}

export function useMediaDownloadUrl(mediaId?: string) {
  return useQuery<MediaDownloadUrlResponse>({
    queryKey: mediaKeys.downloadUrl(mediaId ?? ""),
    queryFn: () =>
      api.get<MediaDownloadUrlResponse>(
        `/v1/editor/media/${mediaId}/download-url`,
      ),
    enabled: !!mediaId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useRequestUploadUrl(themeId: string) {
  return useMutation<UploadUrlResponse, Error, RequestUploadUrlRequest>({
    mutationFn: (body) =>
      api.post<UploadUrlResponse>(
        `/v1/editor/themes/${themeId}/media/upload-url`,
        body,
      ),
  });
}

export function useConfirmUpload(themeId: string) {
  return useMutation<MediaResponse, Error, ConfirmUploadRequest>({
    mutationFn: (body) =>
      api.post<MediaResponse>(
        `/v1/editor/themes/${themeId}/media/confirm`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
    },
  });
}

export function useCreateYouTubeMedia(themeId: string) {
  return useMutation<MediaResponse, Error, CreateYouTubeMediaRequest>({
    mutationFn: (body) =>
      api.post<MediaResponse>(
        `/v1/editor/themes/${themeId}/media/youtube`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
    },
  });
}

export function useUpdateMedia(themeId: string) {
  return useMutation<
    MediaResponse,
    Error,
    { id: string; patch: UpdateMediaRequest }
  >({
    mutationFn: ({ id, patch }) =>
      api.patch<MediaResponse>(`/v1/editor/media/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
    },
  });
}

export function useCreateMediaCategory(themeId: string) {
  return useMutation<MediaCategoryResponse, Error, MediaCategoryRequest>({
    mutationFn: (body) =>
      api.post<MediaCategoryResponse>(
        `/v1/editor/themes/${themeId}/media/categories`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.categories(themeId) });
    },
  });
}

export function useUpdateMediaCategory(themeId: string) {
  return useMutation<
    MediaCategoryResponse,
    Error,
    { id: string; patch: MediaCategoryRequest }
  >({
    mutationFn: ({ id, patch }) =>
      api.patch<MediaCategoryResponse>(`/v1/editor/media/categories/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.categories(themeId) });
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
    },
  });
}

export function useDeleteMediaCategory(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteVoid(`/v1/editor/media/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.categories(themeId) });
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
    },
  });
}

export function useRequestReplacementUpload(mediaId: string) {
  return useMutation<UploadUrlResponse, Error, RequestReplacementUploadRequest>({
    mutationFn: (body) =>
      api.post<UploadUrlResponse>(
        `/v1/editor/media/${mediaId}/replace-upload-url`,
        body,
      ),
  });
}

export function useConfirmReplacementUpload(themeId: string, mediaId: string) {
  return useMutation<MediaResponse, Error, ConfirmUploadRequest>({
    mutationFn: (body) =>
      api.post<MediaResponse>(`/v1/editor/media/${mediaId}/replace-confirm`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
      queryClient.invalidateQueries({ queryKey: mediaKeys.downloadUrl(mediaId) });
    },
  });
}

export function useDeleteMedia(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteVoid(`/v1/editor/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.byTheme(themeId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Upload Helper (3-step: request URL → PUT to R2 → confirm)
// ---------------------------------------------------------------------------

export interface PutFileParams {
  url: string;
  file: File;
  contentType?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** Default putFile implementation using XHR for progress events. */
export function defaultPutFile(params: PutFileParams): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", params.url, true);
    const contentType = params.contentType ?? params.file.type;
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && params.onProgress) {
        params.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`업로드 실패: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("업로드 네트워크 오류"));
    xhr.onabort = () => reject(new Error("업로드가 취소되었습니다"));

    if (params.signal) {
      if (params.signal.aborted) {
        xhr.abort();
        reject(new Error("업로드가 취소되었습니다"));
        return;
      }
      params.signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(params.file);
  });
}

export interface UploadMediaFileParams {
  themeId: string;
  file: File;
  type: MediaType;
  name: string;
  categoryId?: string;
  requestUploadUrl: (
    req: RequestUploadUrlRequest,
  ) => Promise<UploadUrlResponse>;
  confirmUpload: (req: ConfirmUploadRequest) => Promise<MediaResponse>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** Injected for testability; defaults to XHR PUT. */
  putFile?: (params: PutFileParams) => Promise<void>;
  /** Override request MIME when browsers omit File.type (common for PDFs on some platforms). */
  mimeType?: string;
  /** Number of attempts (1 = no retry). Default 3. */
  maxAttempts?: number;
  /** Base delay for exponential backoff in ms. Default 200ms. */
  retryBaseDelayMs?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Three-step media upload: request presigned URL → PUT file → confirm.
 * Retries the PUT step up to maxAttempts on network errors with exponential
 * backoff (baseDelay * 2^attempt).
 */
export async function uploadMediaFile(
  params: UploadMediaFileParams,
): Promise<MediaResponse> {
  const {
    file,
    type,
    name,
    requestUploadUrl,
    confirmUpload,
    onProgress,
    signal,
    putFile = defaultPutFile,
    mimeType,
    maxAttempts = 3,
    retryBaseDelayMs = 200,
  } = params;

  const effectiveMimeType =
    (mimeType ?? file.type) || "application/octet-stream";

  // Step 1: request presigned URL
  const uploadUrl = await requestUploadUrl({
    name,
    type,
    mime_type: effectiveMimeType,
    file_size: file.size,
    category_id: params.categoryId,
  });

  // Step 2: PUT to R2 with retry
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error("업로드가 취소되었습니다");
    }
    try {
      await putFile({
        url: uploadUrl.upload_url,
        file,
        contentType: effectiveMimeType,
        onProgress,
        signal,
      });
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
      }
    }
  }
  if (lastError) {
    throw lastError;
  }

  // Step 3: confirm
  const media = await confirmUpload({ upload_id: uploadUrl.upload_id });
  return media;
}
