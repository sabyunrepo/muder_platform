import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageMediaReferenceField } from "../ImageMediaReferenceField";
import type { MediaResponse } from "@/features/editor/mediaApi";

const { useMediaListMock, useMediaDownloadUrlMock } = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
  useMediaDownloadUrlMock: vi.fn(),
}));

vi.mock("@/features/editor/mediaApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/mediaApi")>();
  return {
    ...actual,
    useMediaList: (...args: unknown[]) => useMediaListMock(...args),
    useMediaDownloadUrl: (...args: unknown[]) => useMediaDownloadUrlMock(...args),
  };
});

vi.mock("../MediaPicker", () => ({
  MediaPicker: ({ open }: { open: boolean }) => (open ? <div>미디어 선택</div> : null),
}));

const imageMedia: MediaResponse = {
  id: "image-1",
  theme_id: "theme-1",
  name: "우산걸이",
  type: "IMAGE",
  source_type: "FILE",
  file_size: 1234,
  mime_type: "image/webp",
  tags: [],
  sort_order: 1,
  created_at: "2026-05-17T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useMediaListMock.mockReturnValue({ data: [imageMedia], isLoading: false, isError: false });
  useMediaDownloadUrlMock.mockReturnValue({
    data: { url: "https://download.example/umbrella.webp", expires_at: "2026-05-17T00:15:00Z" },
    isLoading: false,
    isError: false,
  });
});

afterEach(() => cleanup());

describe("ImageMediaReferenceField", () => {
  it("선택 상태는 이미지 타일 위 overlay group에 교체와 제거를 항상 표시한다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", { name: "단서 이미지 미리보기" });
    expect(tile.className).toContain("aspect-[16/10]");
    expect(tile.className).toContain("overflow-hidden");
    expect(tile.className).toContain("focus-visible:ring-2");
    expect(tile.parentElement?.className).toBe("relative");
    expect(tile.parentElement?.parentElement?.className).not.toContain("p-3");
    expect(tile.parentElement?.parentElement?.className).not.toContain("border-slate-800");
    expect(screen.getByText("교체").parentElement?.className).toContain("absolute");
    expect(screen.getByRole("button", { name: "단서 이미지 교체" }).className).toContain(
      "focus-visible:ring-2",
    );
    expect(screen.getByRole("button", { name: "단서 이미지 제거" }).className).toContain(
      "focus-visible:ring-2",
    );
    expect(useMediaListMock).not.toHaveBeenCalled();
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith("image-1");
  });

  it("overlay 제거 버튼은 picker를 열지 않고 onClear만 호출한다", () => {
    const onClear = vi.fn();

    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "단서 이미지 제거" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("미디어 선택")).toBeNull();
  });

  it("disabled 선택 상태는 overlay action을 숨기고 picker를 열지 않는다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        disabled
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", { name: "단서 이미지 미리보기" });
    expect(tile).toHaveProperty("disabled", true);
    expect(tile.className).toContain("focus-visible:ring-2");
    expect(screen.queryByRole("button", { name: "단서 이미지 교체" })).toBeNull();
    expect(screen.queryByRole("button", { name: "단서 이미지 제거" })).toBeNull();

    fireEvent.click(tile);

    expect(screen.queryByText("미디어 선택")).toBeNull();
  });

  it("선택된 이미지는 전체 IMAGE 목록 없이 단건 다운로드 URL로 프리뷰를 보여준다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(useMediaListMock).not.toHaveBeenCalled();
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith("image-1");

    const preview = screen.getByAltText("단서 이미지 미리보기") as HTMLImageElement;
    expect(preview.getAttribute("src")).toBe("https://download.example/umbrella.webp");
  });

  it("프리뷰 로드가 실패하면 이미지 아이콘 fallback으로 돌아간다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByAltText("단서 이미지 미리보기"));

    screen.getByLabelText("이미지");
    expect(screen.queryByAltText("단서 이미지 미리보기")).toBeNull();
  });
});
