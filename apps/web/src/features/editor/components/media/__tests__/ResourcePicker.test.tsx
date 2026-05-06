import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourcePicker } from "../ResourcePicker";
import type { PickerMediaResource } from "../ResourcePicker";

const resources: PickerMediaResource[] = [
  {
    id: "resource-1",
    name: "오프닝 BGM",
    type: "BGM",
    typeLabel: "배경음악",
    sourceLabel: "업로드 파일",
    durationLabel: "2:05",
    fileSizeLabel: "1.5MB",
    metaLabel: "배경음악 · 업로드 파일 · 2:05 · 1.5MB",
    tags: ["오프닝"],
    isExternal: false,
    canPreview: true,
    isSelectable: true,
    unselectableReason: null,
  },
  {
    id: "resource-2",
    name: "엔딩 영상",
    type: "VIDEO",
    typeLabel: "영상",
    sourceLabel: "YouTube",
    durationLabel: null,
    fileSizeLabel: null,
    metaLabel: "영상 · YouTube",
    tags: [],
    isExternal: true,
    canPreview: false,
    isSelectable: false,
    unselectableReason: "페이즈 배경음악에는 배경음악만 선택할 수 있어요.",
  },
];

afterEach(() => cleanup());

describe("ResourcePicker", () => {
  it("제작자용 리소스 목록과 검색 입력을 렌더링한다", () => {
    render(
      <ResourcePicker
        title="리소스 선택"
        resources={resources}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "리소스 선택" })).toBeDefined();
    expect(screen.getByText("오프닝 BGM")).toBeDefined();
    expect(screen.getByText("배경음악 · 업로드 파일 · 2:05 · 1.5MB")).toBeDefined();
    expect(screen.getByLabelText("미디어 이름 검색")).toBeDefined();
  });

  it("검색어 변경과 닫기 액션을 부모에 전달한다", () => {
    const onSearchQueryChange = vi.fn();
    const onClose = vi.fn();
    render(
      <ResourcePicker
        title="리소스 선택"
        resources={resources}
        searchQuery=""
        onSearchQueryChange={onSearchQueryChange}
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("미디어 이름 검색"), {
      target: { value: "오프닝" },
    });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onSearchQueryChange).toHaveBeenCalledWith("오프닝");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("선택 가능한 리소스만 선택 이벤트를 발생시킨다", () => {
    const onSelect = vi.fn();
    render(
      <ResourcePicker
        title="리소스 선택"
        resources={resources}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("오프닝 BGM").closest("button")!);
    fireEvent.click(screen.getByText("엔딩 영상").closest("button")!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("resource-1");
    expect(screen.getByText(/배경음악만 선택/)).toBeDefined();
  });

  it("외부 리소스에는 YouTube 표시를 보여준다", () => {
    render(
      <ResourcePicker
        title="리소스 선택"
        resources={resources}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("YouTube")).toBeDefined();
  });

  it("썸네일 URL이 있으면 이미지를 보여주고 실패 시 타입 fallback을 보여준다", () => {
    render(
      <ResourcePicker
        title="리소스 선택"
        resources={[
          {
            ...resources[0],
            type: "IMAGE",
            typeLabel: "이미지",
            thumbnailUrl: "https://example.com/image.webp",
          },
        ]}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toBe("https://example.com/image.webp");

    fireEvent.error(image);
    expect(screen.getByLabelText("이미지")).toBeDefined();
  });

  it("썸네일 없는 영상/문서는 타입 fallback 아이콘으로 구분한다", () => {
    render(
      <ResourcePicker
        title="리소스 선택"
        resources={[
          {
            ...resources[0],
            id: "video-1",
            name: "엔딩 영상",
            type: "VIDEO",
            typeLabel: "영상",
            metaLabel: "영상 · 업로드 파일",
          },
          {
            ...resources[0],
            id: "doc-1",
            name: "역할지 PDF",
            type: "DOCUMENT",
            typeLabel: "문서",
            metaLabel: "문서 · 업로드 파일",
          },
        ]}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("영상")).toBeDefined();
    expect(screen.getByLabelText("문서")).toBeDefined();
  });

  it("빈 상태와 로딩 상태를 사용자 문장으로 표시한다", () => {
    const { rerender } = render(
      <ResourcePicker
        title="리소스 선택"
        resources={[]}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("리소스가 없습니다")).toBeDefined();

    rerender(
      <ResourcePicker
        title="리소스 선택"
        resources={[]}
        searchQuery="abc"
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("검색 결과가 없습니다")).toBeDefined();

    rerender(
      <ResourcePicker
        title="리소스 선택"
        resources={[]}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        isLoading={true}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("불러오는 중...");
  });
});
