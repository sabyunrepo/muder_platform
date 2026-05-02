import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types — match backend snake_case JSON exactly
// ---------------------------------------------------------------------------

export type MediaType = "BGM" | "SFX" | "VOICE" | "VIDEO" | "DOCUMENT";
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
  created_at: string;
}

export interface RequestUploadUrlRequest {
  name: string;
  type: MediaType;
  mime_type: string;
  file_size: number;
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
  list: (themeId: string, type?: MediaType) =>
    ["media", themeId, type ?? "all"] as const,
  byTheme: (themeId: string) => ["media", themeId] as const,
  downloadUrl: (mediaId: string) => ["media", mediaId, "download-url"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMediaList(themeId: string, type?: MediaType) {
  return useQuery<MediaResponse[]>({
    queryKey: mediaKeys.list(themeId, type),
    queryFn: () => {
      const qs = type ? `?type=${encodeURIComponent(type)}` : "";
      return api.get<MediaResponse[]>(
        `/v1/editor/themes/${themeId}/media${qs}`,
      );
    },
    enabled: !!themeId,
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
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** Default putFile implementation using XHR for progress events. */
export function defaultPutFile(params: PutFileParams): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", params.url, true);
    if (params.file.type) {
      xhr.setRequestHeader("Content-Type", params.file.type);
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
  requestUploadUrl: (
    req: RequestUploadUrlRequest,
  ) => Promise<UploadUrlResponse>;
  confirmUpload: (req: ConfirmUploadRequest) => Promise<MediaResponse>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** Injected for testability; defaults to XHR PUT. */
  putFile?: (params: PutFileParams) => Promise<void>;
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
    maxAttempts = 3,
    retryBaseDelayMs = 200,
  } = params;

  // Step 1: request presigned URL
  const uploadUrl = await requestUploadUrl({
    name,
    type,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
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
