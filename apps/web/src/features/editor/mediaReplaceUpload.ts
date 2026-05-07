import {
  defaultPutFile,
  type ConfirmUploadRequest,
  type MediaResponse,
  type PutFileParams,
  type RequestReplacementUploadRequest,
  type UploadUrlResponse,
} from "@/features/editor/mediaApi";

export interface ReplaceMediaFileParams {
  file: File;
  requestReplacementUpload: (
    req: RequestReplacementUploadRequest,
  ) => Promise<UploadUrlResponse>;
  confirmReplacementUpload: (
    req: ConfirmUploadRequest,
  ) => Promise<MediaResponse>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  putFile?: (params: PutFileParams) => Promise<void>;
  mimeType?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function replaceMediaFile(
  params: ReplaceMediaFileParams,
): Promise<MediaResponse> {
  const {
    file,
    requestReplacementUpload,
    confirmReplacementUpload,
    onProgress,
    signal,
    putFile = defaultPutFile,
    mimeType,
    maxAttempts = 3,
    retryBaseDelayMs = 200,
  } = params;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts는 1 이상의 정수여야 합니다");
  }

  const effectiveMimeType =
    (mimeType ?? file.type) || "application/octet-stream";

  const uploadUrl = await requestReplacementUpload({
    mime_type: effectiveMimeType,
    file_size: file.size,
  });

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
      if (signal?.aborted) {
        throw err;
      }
      if (attempt < maxAttempts - 1) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
      }
    }
  }
  if (lastError) {
    throw lastError;
  }

  return confirmReplacementUpload({ upload_id: uploadUrl.upload_id });
}
