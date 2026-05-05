import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  useEditorCharactersMock,
  useEditorCluesMock,
  useEditorLocationsMock,
  useMediaListMock,
} = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useEditorLocationsMock: vi.fn(),
  useMediaListMock: vi.fn(),
}));

vi.mock("../../design/FlowCanvas", () => ({
  FlowCanvas: ({
    themeId,
    onSelectedNodeChange,
  }: {
    themeId: string;
    onSelectedNodeChange?: (node: unknown) => void;
  }) => (
    <div data-testid="flow-canvas">
      flow canvas {themeId}
      <button
        type="button"
        onClick={() =>
          onSelectedNodeChange?.({
            id: "scene-1",
            type: "phase",
            data: {
              label: "오프닝",
              description: "도입 장면",
              discussionRoomPolicy: { enabled: true },
            },
          })
        }
      >
        장면 선택
      </button>
    </div>
  ),
}));

vi.mock("@/features/editor/api", () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useEditorClues: () => useEditorCluesMock(),
  useEditorLocations: () => useEditorLocationsMock(),
}));

vi.mock("@/features/editor/mediaApi", () => ({
  useMediaList: () => useMediaListMock(),
}));

import { StoryMapWorkspace } from "../StoryMapWorkspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StoryMapWorkspace", () => {
  beforeEach(() => {
    useEditorCharactersMock.mockReturnValue({
      data: [{ id: "char-1", name: "한서윤", is_playable: true }],
      isLoading: false,
      isError: false,
    });
    useEditorCluesMock.mockReturnValue({
      data: [{ id: "clue-1", name: "찢어진 초대장", location_id: null }],
      isLoading: false,
      isError: false,
    });
    useEditorLocationsMock.mockReturnValue({
      data: [{ id: "loc-1", name: "응접실", from_round: null, until_round: null }],
      isLoading: false,
      isError: false,
    });
    useMediaListMock.mockReturnValue({
      data: [{ id: "media-1", name: "오프닝 음악", type: "BGM" }],
      isLoading: false,
      isError: false,
    });
  });

  it("스토리 진행 중심 제작 화면과 플로우 캔버스를 함께 렌더링한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    expect(screen.getByRole("heading", { name: "스토리 진행 제작" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "제작 라이브러리" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "장면 속성" })).toBeDefined();
    expect(screen.getByTestId("flow-canvas").textContent).toContain("theme-1");
  });

  it("작성자가 장면 흐름에 연결할 엔티티 묶음을 볼 수 있다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    expect(screen.getByText("한서윤")).toBeDefined();
    expect(screen.getByText("찢어진 초대장")).toBeDefined();
    expect(screen.getByText("응접실")).toBeDefined();
    expect(screen.getByText("오프닝 음악")).toBeDefined();
    expect(screen.getByText("단서")).toBeDefined();
    expect(screen.getAllByText("장소").length).toBeGreaterThan(1);
    expect(screen.getAllByText("토론방").length).toBeGreaterThan(1);
    expect(screen.getAllByText("조사권").length).toBeGreaterThan(1);
  });

  it("라이브러리 항목을 선택하면 우측 패널에 연결 대상으로 표시한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: /찢어진 초대장/ }));

    expect(screen.getByText("선택한 연결 대상")).toBeDefined();
    expect(screen.getAllByText("찢어진 초대장").length).toBeGreaterThan(1);
  });

  it("중앙 흐름에서 장면이 선택되면 우측 패널에 장면 요약을 표시한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: "장면 선택" }));

    expect(screen.getByText("오프닝")).toBeDefined();
    expect(screen.getByText("스토리 장면")).toBeDefined();
    expect(screen.getByText("장면 설명 있음")).toBeDefined();
    expect(screen.getByText("사용")).toBeDefined();
  });
});
