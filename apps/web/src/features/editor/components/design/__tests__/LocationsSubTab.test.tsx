import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  toastSuccess,
  toastError,
  mutateMock,
  useEditorMapsMock,
  useCreateMapMock,
  useDeleteMapMock,
  useEditorLocationsMock,
  useCreateLocationMock,
  useDeleteLocationMock,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mutateMock: vi.fn(),
  useEditorMapsMock: vi.fn(),
  useCreateMapMock: vi.fn(),
  useDeleteMapMock: vi.fn(),
  useEditorLocationsMock: vi.fn(),
  useCreateLocationMock: vi.fn(),
  useDeleteLocationMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// ---------------------------------------------------------------------------
// Mock: @/features/editor/api
// ---------------------------------------------------------------------------

vi.mock("@/features/editor/api", () => ({
  useEditorMaps: () => useEditorMapsMock(),
  useCreateMap: () => useCreateMapMock(),
  useDeleteMap: () => useDeleteMapMock(),
  useEditorLocations: () => useEditorLocationsMock(),
  useCreateLocation: () => useCreateLocationMock(),
  useDeleteLocation: () => useDeleteLocationMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { LocationsSubTab } from "../LocationsSubTab";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTheme = {
  id: "theme-1",
  title: "테스트 테마",
  slug: "test-theme",
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  coin_price: 0,
  status: "DRAFT" as const,
  config_json: null,
  version: 1,
  created_at: "2026-04-13T00:00:00Z",
};

const mockMaps = [
  { id: "map-1", theme_id: "theme-1", name: "저택 1층", image_url: null, sort_order: 1, created_at: "2026-04-13T00:00:00Z" },
  { id: "map-2", theme_id: "theme-1", name: "저택 2층", image_url: null, sort_order: 2, created_at: "2026-04-13T00:00:00Z" },
];

const mockLocations = [
  { id: "loc-1", theme_id: "theme-1", map_id: "map-1", name: "거실", restricted_characters: null, sort_order: 1, created_at: "2026-04-13T00:00:00Z" },
  { id: "loc-2", theme_id: "theme-1", map_id: "map-1", name: "주방", restricted_characters: null, sort_order: 2, created_at: "2026-04-13T00:00:00Z" },
  { id: "loc-3", theme_id: "theme-1", map_id: "map-2", name: "침실", restricted_characters: null, sort_order: 1, created_at: "2026-04-13T00:00:00Z" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultMutation() {
  return { mutate: mutateMock, isPending: false };
}

function setupDefaultMocks() {
  useEditorMapsMock.mockReturnValue({ data: mockMaps, isLoading: false });
  useEditorLocationsMock.mockReturnValue({ data: mockLocations, isLoading: false });
  useCreateMapMock.mockReturnValue(defaultMutation());
  useDeleteMapMock.mockReturnValue(defaultMutation());
  useCreateLocationMock.mockReturnValue(defaultMutation());
  useDeleteLocationMock.mockReturnValue(defaultMutation());
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LocationsSubTab", () => {
  describe("로딩 상태", () => {
    it("맵 로딩 중일 때 스피너를 표시한다", () => {
      useEditorMapsMock.mockReturnValue({ data: undefined, isLoading: true });
      useEditorLocationsMock.mockReturnValue({ data: undefined, isLoading: false });
      useCreateMapMock.mockReturnValue(defaultMutation());
      useDeleteMapMock.mockReturnValue(defaultMutation());
      useCreateLocationMock.mockReturnValue(defaultMutation());
      useDeleteLocationMock.mockReturnValue(defaultMutation());

      const { container } = render(
        <LocationsSubTab themeId="theme-1" theme={mockTheme} />,
      );
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).not.toBeNull();
    });
  });

  describe("맵 목록 렌더링", () => {
    beforeEach(setupDefaultMocks);

    it("맵 이름들을 렌더링한다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.getByText("저택 1층")).toBeDefined();
      expect(screen.getByText("저택 2층")).toBeDefined();
    });

    it("맵이 없을 때 빈 상태를 표시한다", () => {
      useEditorMapsMock.mockReturnValue({ data: [], isLoading: false });
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.getByText("맵 없음")).toBeDefined();
    });

    it("맵 추가 버튼이 존재한다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      const addBtn = screen.getByLabelText("맵 추가");
      expect(addBtn).toBeDefined();
    });
  });

  describe("맵 추가 UI", () => {
    beforeEach(setupDefaultMocks);

    it("맵 추가 버튼 클릭 시 인라인 입력이 나타난다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText("맵 추가"));
      expect(screen.getByPlaceholderText("맵 이름")).toBeDefined();
    });

    it("취소 버튼 클릭 시 입력 필드가 사라진다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText("맵 추가"));
      expect(screen.getByPlaceholderText("맵 이름")).toBeDefined();
      fireEvent.click(screen.getByText("취소"));
      expect(screen.queryByPlaceholderText("맵 이름")).toBeNull();
    });

    it("Enter 키로 맵을 추가하면 mutate가 호출된다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText("맵 추가"));
      const input = screen.getByPlaceholderText("맵 이름");
      fireEvent.change(input, { target: { value: "새 맵" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mutateMock).toHaveBeenCalledWith(
        { name: "새 맵" },
        expect.any(Object),
      );
    });
  });

  describe("맵 삭제 UI", () => {
    beforeEach(setupDefaultMocks);

    it("맵 삭제 버튼이 각 맵에 존재한다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      const deleteBtn = screen.getByLabelText("저택 1층 삭제");
      expect(deleteBtn).toBeDefined();
    });

    it("맵 삭제 버튼 클릭 시 mutate가 호출된다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText("저택 1층 삭제"));
      expect(mutateMock).toHaveBeenCalledWith("map-1", expect.any(Object));
    });
  });

  describe("장소 목록 렌더링", () => {
    beforeEach(setupDefaultMocks);

    it("맵 미선택 시 empty state를 표시한다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.getByText("좌측에서 맵을 선택하세요")).toBeDefined();
    });

    it("맵 선택 시 해당 맵의 장소만 표시한다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText("저택 1층"));
      expect(screen.getByText("거실")).toBeDefined();
      expect(screen.getByText("주방")).toBeDefined();
      // 다른 맵의 장소는 표시되지 않아야 함
      expect(screen.queryByText("침실")).toBeNull();
    });

    it("선택한 맵에 장소가 없을 때 빈 상태를 표시한다", () => {
      useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false });
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText("저택 1층"));
      expect(screen.getByText("장소 없음")).toBeDefined();
    });
  });

  describe("장소 추가 UI", () => {
    beforeEach(setupDefaultMocks);

    it("맵 선택 후 장소 추가 버튼이 나타난다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText("저택 1층"));
      expect(screen.getByText("장소 추가")).toBeDefined();
    });

    it("장소 추가 버튼 클릭 시 인라인 입력이 나타난다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText("저택 1층"));
      fireEvent.click(screen.getByText("장소 추가"));
      expect(screen.getByPlaceholderText("장소 이름")).toBeDefined();
    });

    it("Enter 키로 장소를 추가하면 mutate가 호출된다", () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText("저택 1층"));
      fireEvent.click(screen.getByText("장소 추가"));
      const input = screen.getByPlaceholderText("장소 이름");
      fireEvent.change(input, { target: { value: "서재" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mutateMock).toHaveBeenCalledWith(
        { mapId: "map-1", body: { name: "서재" } },
        expect.any(Object),
      );
    });
  });
});
