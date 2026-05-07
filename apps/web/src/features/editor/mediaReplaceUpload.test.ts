import { describe, expect, it, vi } from "vitest";

import { replaceMediaFile } from "./mediaReplaceUpload";

describe("replaceMediaFile", () => {
  it("교체 업로드 URL 요청, PUT, confirm 순서로 media id 유지 교체를 완료한다", async () => {
    const file = new File(["image"], "evidence.png", { type: "image/png" });
    const requestReplacementUpload = vi.fn().mockResolvedValue({
      upload_id: "replace-upload-1",
      upload_url: "https://upload.example.com/replacement",
      expires_at: "2026-05-07T00:00:00Z",
    });
    const putFile = vi.fn().mockResolvedValue(undefined);
    const confirmReplacementUpload = vi.fn().mockResolvedValue({
      id: "media-1",
      name: "증거 사진",
      type: "IMAGE",
      source_type: "FILE",
      tags: [],
      sort_order: 1,
      created_at: "2026-05-07T00:00:00Z",
    });
    const onProgress = vi.fn();

    const result = await replaceMediaFile({
      file,
      requestReplacementUpload,
      confirmReplacementUpload,
      putFile,
      onProgress,
    });

    expect(requestReplacementUpload).toHaveBeenCalledWith({
      mime_type: "image/png",
      file_size: file.size,
    });
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://upload.example.com/replacement",
        file,
        contentType: "image/png",
        onProgress,
      }),
    );
    expect(confirmReplacementUpload).toHaveBeenCalledWith({
      upload_id: "replace-upload-1",
    });
    expect(result.id).toBe("media-1");
  });

  it("PUT 네트워크 실패는 지정 횟수만큼 재시도한다", async () => {
    const file = new File(["voice"], "voice.mp3", { type: "audio/mpeg" });
    const requestReplacementUpload = vi.fn().mockResolvedValue({
      upload_id: "replace-upload-2",
      upload_url: "https://upload.example.com/retry",
      expires_at: "2026-05-07T00:00:00Z",
    });
    const putFile = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const confirmReplacementUpload = vi.fn().mockResolvedValue({
      id: "media-2",
      name: "보이스",
      type: "VOICE",
      source_type: "FILE",
      tags: [],
      sort_order: 1,
      created_at: "2026-05-07T00:00:00Z",
    });

    await replaceMediaFile({
      file,
      requestReplacementUpload,
      confirmReplacementUpload,
      putFile,
      retryBaseDelayMs: 0,
    });

    expect(putFile).toHaveBeenCalledTimes(2);
    expect(confirmReplacementUpload).toHaveBeenCalledTimes(1);
  });

  it("취소된 PUT 실패는 재시도하지 않고 confirm도 호출하지 않는다", async () => {
    const file = new File(["voice"], "voice.mp3", { type: "audio/mpeg" });
    const abortController = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const requestReplacementUpload = vi.fn().mockResolvedValue({
      upload_id: "replace-upload-abort",
      upload_url: "https://upload.example.com/abort",
      expires_at: "2026-05-07T00:00:00Z",
    });
    const putFile = vi.fn().mockImplementation(() => {
      abortController.abort();
      return Promise.reject(abortError);
    });
    const confirmReplacementUpload = vi.fn();

    await expect(
      replaceMediaFile({
        file,
        requestReplacementUpload,
        confirmReplacementUpload,
        putFile,
        signal: abortController.signal,
        retryBaseDelayMs: 0,
      }),
    ).rejects.toBe(abortError);

    expect(putFile).toHaveBeenCalledTimes(1);
    expect(confirmReplacementUpload).not.toHaveBeenCalled();
  });

  it("maxAttempts가 1 미만이면 업로드 URL 요청 없이 실패한다", async () => {
    const file = new File(["image"], "evidence.png", { type: "image/png" });
    const requestReplacementUpload = vi.fn();
    const putFile = vi.fn();
    const confirmReplacementUpload = vi.fn();

    await expect(
      replaceMediaFile({
        file,
        requestReplacementUpload,
        confirmReplacementUpload,
        putFile,
        maxAttempts: 0,
      }),
    ).rejects.toThrow("maxAttempts는 1 이상의 정수여야 합니다");

    expect(requestReplacementUpload).not.toHaveBeenCalled();
    expect(putFile).not.toHaveBeenCalled();
    expect(confirmReplacementUpload).not.toHaveBeenCalled();
  });
});
