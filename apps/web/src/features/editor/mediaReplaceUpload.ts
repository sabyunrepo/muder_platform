import {
  defaultUploadReplacementFileViaServer,
  defaultPutFile,
  type ConfirmUploadRequest,
  type MediaResponse,
  type PutFileParams,
  type RequestReplacementUploadRequest,
  type ServerReplacementUploadFileParams,
  type UploadUrlResponse,
} from "@/features/editor/mediaApi";

export interface ReplaceMediaFileParams {
  file: File;
  mediaId: string;
  requestReplacementUpload: (
    req: RequestReplacementUploadRequest,
  ) => Promise<UploadUrlResponse>;
  confirmReplacementUpload: (
    req: ConfirmUploadRequest,
  ) => Promise<MediaResponse>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  putFile?: (params: PutFileParams) => Promise<void>;
  uploadReplacementViaServer?: (
    params: ServerReplacementUploadFileParams,
  ) => Promise<void>;
  mimeType?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error("업로드가 취소되었습니다");
  }
};

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
    uploadReplacementViaServer = defaultUploadReplacementFileViaServer,
    mimeType,
    maxAttempts = 3,
    retryBaseDelayMs = 200,
    mediaId,
  } = params;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts는 1 이상의 정수여야 합니다");
  }

  const effectiveMimeType =
    (mimeType ?? file.type) || "application/octet-stream";

  throwIfAborted(signal);
  const uploadUrl = await requestReplacementUpload({
    mime_type: effectiveMimeType,
    file_size: file.size,
  });
  throwIfAborted(signal);

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    throwIfAborted(signal);
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
        throwIfAborted(signal);
      }
    }
  }
  if (lastError) {
    await uploadReplacementViaServer({
      mediaId,
      uploadId: uploadUrl.upload_id,
      file,
      contentType: effectiveMimeType,
      onProgress,
      signal,
    });
  }

  throwIfAborted(signal);
  return confirmReplacementUpload({ upload_id: uploadUrl.upload_id });
}
