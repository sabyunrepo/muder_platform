import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useMediaListMock,
  useMediaCategoriesMock,
  useRequestUploadUrlMock,
  useConfirmUploadMock,
  uploadMediaFileMock,
} = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
  useMediaCategoriesMock: vi.fn(),
  useRequestUploadUrlMock: vi.fn(),
  useConfirmUploadMock: vi.fn(),
  uploadMediaFileMock: vi.fn(),
}));

vi.mock("@/features/editor/mediaApi", () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
  useMediaCategories: (...args: unknown[]) => useMediaCategoriesMock(...args),
  useRequestUploadUrl: () => useRequestUploadUrlMock(),
  useConfirmUpload: () => useConfirmUploadMock(),
  uploadMediaFile: (...args: unknown[]) => uploadMediaFileMock(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { MediaPicker } from "../MediaPicker";
import type { MediaResponse } from "@/features/editor/mediaApi";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockMedia: MediaResponse[] = [
  {
    id: "media-1",
    theme_id: "theme-1",
    name: "오프닝 BGM",
    type: "BGM",
    source_type: "FILE",
    url: "https://example.com/bgm.mp3",
    duration: 125,
    file_size: 1234567,
    mime_type: "audio/mpeg",
    tags: [],
    sort_order: 1,
    created_at: "2026-04-05T00:00:00Z",
  },
  {
    id: "media-2",
    theme_id: "theme-1",
    name: "문 닫는 소리",
    type: "SFX",
    source_type: "FILE",
    url: "https://example.com/sfx.mp3",
    duration: 3,
    file_size: 1024,
    mime_type: "audio/mpeg",
    tags: [],
    sort_order: 2,
    created_at: "2026-04-05T00:00:00Z",
  },
  {
    id: "media-3",
    theme_id: "theme-1",
    name: "유튜브 트랙",
    type: "BGM",
    source_type: "YOUTUBE",
    url: "https://www.youtube.com/watch?v=xyz",
    tags: [],
    sort_order: 3,
    created_at: "2026-04-05T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  useMediaListMock.mockReturnValue({
    data: mockMedia,
    isLoading: false,
  });
  useMediaCategoriesMock.mockReturnValue({
    data: [
      {
        id: "category-screen",
        theme_id: "theme-1",
        name: "스크린",
        sort_order: 1,
        created_at: "2026-04-05T00:00:00Z",
      },
    ],
  });
  useRequestUploadUrlMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useConfirmUploadMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// =========================================================================
// MediaPicker
// =========================================================================

describe("MediaPicker", () => {
  it("닫혀있을 때는 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <MediaPicker
        open={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("열렸을 때 미디어 목록을 렌더링한다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    expect(screen.getByText("오프닝 BGM")).toBeDefined();
    expect(screen.getByText("문 닫는 소리")).toBeDefined();
    expect(screen.getByText("유튜브 트랙")).toBeDefined();
  });

  it("filterType이 설정되면 useMediaList에 타입을 전달한다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
        filterType="BGM"
      />,
    );
    expect(useMediaListMock).toHaveBeenCalledWith("theme-1", "BGM", undefined);
    // Footer hint 표시
    expect(screen.getByText(/배경음악 유형만 표시됩니다/)).toBeDefined();
  });

  it.each([
    ["IMAGE", "이미지 유형만 표시됩니다"],
    ["VIDEO", "영상 유형만 표시됩니다"],
  ] as const)("filterType %s도 useMediaList와 안내문에 반영한다", (filterType, hint) => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
        filterType={filterType}
      />,
    );

    expect(useMediaListMock).toHaveBeenCalledWith("theme-1", filterType, undefined);
    expect(screen.getByText(hint)).toBeDefined();
  });

  it("검색어로 이름을 필터링한다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );

    const search = screen.getByLabelText("미디어 이름 검색") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "오프닝" } });

    expect(screen.getByText("오프닝 BGM")).toBeDefined();
    expect(screen.queryByText("문 닫는 소리")).toBeNull();
    expect(screen.queryByText("유튜브 트랙")).toBeNull();
  });

  it("항목 클릭 시 onSelect와 onClose가 호출된다", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <MediaPicker
        open={true}
        onClose={onClose}
        onSelect={onSelect}
        themeId="theme-1"
      />,
    );

    const item = screen.getByText("오프닝 BGM").closest("button") as HTMLElement;
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockMedia[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("미디어가 없을 때 빈 상태를 표시한다", () => {
    useMediaListMock.mockReturnValue({ data: [], isLoading: false });
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    expect(screen.getByText("미디어가 없습니다")).toBeDefined();
  });

  it("검색 결과가 없으면 별도의 빈 상태를 표시한다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    const search = screen.getByLabelText("미디어 이름 검색") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "존재하지않는항목" } });
    expect(screen.getByText("검색 결과가 없습니다")).toBeDefined();
  });

  it("YOUTUBE source_type 항목에 YouTube 아이콘을 표시하되 raw URL은 노출하지 않는다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    expect(screen.getByLabelText("YouTube")).toBeDefined();
    expect(screen.queryByText("https://www.youtube.com/watch?v=xyz")).toBeNull();
    expect(screen.queryByText("https://example.com/bgm.mp3")).toBeNull();
  });

  it("selectedId와 일치하는 항목을 강조한다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
        selectedId="media-2"
      />,
    );
    const selectedBtn = screen
      .getByText("문 닫는 소리")
      .closest("button") as HTMLElement;
    expect(selectedBtn.getAttribute("aria-pressed")).toBe("true");

    const otherBtn = screen
      .getByText("오프닝 BGM")
      .closest("button") as HTMLElement;
    expect(otherBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("useCase가 맞지 않는 항목은 목록에서 제외한다", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <MediaPicker
        open={true}
        onClose={onClose}
        onSelect={onSelect}
        themeId="theme-1"
        useCase="role_sheet_document"
      />,
    );

    expect(screen.queryByText("오프닝 BGM")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("미디어가 없습니다")).toBeDefined();
  });

  it("카테고리 탭 선택 시 해당 카테고리로 목록을 다시 조회한다", () => {
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "스크린", pressed: false }));

    expect(useMediaListMock).toHaveBeenLastCalledWith("theme-1", undefined, "category-screen");
  });

  it("로딩 상태를 표시한다", () => {
    useMediaListMock.mockReturnValue({ data: undefined, isLoading: true });
    render(
      <MediaPicker
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("불러오는 중...")).toBeDefined();
  });

  it("닫기 버튼을 클릭하면 onClose가 호출된다", () => {
    const onClose = vi.fn();
    render(
      <MediaPicker
        open={true}
        onClose={onClose}
        onSelect={vi.fn()}
        themeId="theme-1"
      />,
    );
    const closeBtn = screen.getByRole("button", { name: "닫기" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
