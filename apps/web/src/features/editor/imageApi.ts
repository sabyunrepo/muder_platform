import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "@/features/editor/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadUrlRequest {
  target: "character" | "clue" | "cover";
  target_id?: string;
  content_type: string;
  file_size: number;
}

interface UploadUrlResponse {
  upload_url: string;
  upload_key: string;
}

interface ConfirmResponse {
  image_url: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useRequestImageUpload(themeId: string) {
  return useMutation<UploadUrlResponse, Error, UploadUrlRequest>({
    mutationFn: (body) =>
      api.post<UploadUrlResponse>(
        `/v1/editor/themes/${themeId}/images/upload-url`,
        body,
      ),
  });
}

export function useConfirmImageUpload(themeId: string) {
  return useMutation<ConfirmResponse, Error, { upload_key: string }>({
    mutationFn: (body) =>
      api.post<ConfirmResponse>(
        `/v1/editor/themes/${themeId}/images/confirm`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: full upload flow (request URL → PUT file → confirm)
// ---------------------------------------------------------------------------

export async function uploadImage(
  themeId: string,
  target: "character" | "clue" | "cover",
  targetId: string,
  file: Blob,
  contentType: string,
): Promise<string> {
  // Guard: caller must pass a concrete themeId. Without this, path becomes
  // `/v1/editor/themes/undefined/images/upload-url` → 404.
  if (!themeId) {
    throw new Error("themeId is required for image upload");
  }

  // 1. Get presigned URL
  // NOTE: path intentionally starts with `/v1/...`; ApiClient prepends `/api`
  // so full URL resolves to `/api/v1/editor/themes/{id}/images/upload-url`,
  // which matches the backend route registered in main.go.
  const { upload_url, upload_key } = await api.post<UploadUrlResponse>(
    `/v1/editor/themes/${themeId}/images/upload-url`,
    {
      target,
      content_type: contentType,
      file_size: file.size,
      ...(target !== "cover" && targetId ? { target_id: targetId } : {}),
    },
  );

  // 2. PUT to presigned URL (bypass api client — no auth header needed for S3)
  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error("Failed to upload image to storage");

  // 3. Confirm upload and get final URL
  const { image_url } = await api.post<ConfirmResponse>(
    `/v1/editor/themes/${themeId}/images/confirm`,
    { upload_key },
  );

  return image_url;
}
