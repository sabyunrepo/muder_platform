import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  FlowCanvas: ({ themeId }: { themeId: string }) => (
    <div data-testid="flow-canvas">flow canvas {themeId}</div>
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

function getScenePropertiesPanel(): HTMLElement {
  const panel = screen.getByRole("heading", { name: "장면 속성" }).closest("aside");
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

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
    expect(screen.getByText("장소")).toBeDefined();
    expect(screen.getByText("토론방")).toBeDefined();
    expect(screen.getByText("조사권")).toBeDefined();
  });

  it("라이브러리 항목을 선택하면 우측 패널에 연결 대상으로 표시한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: /찢어진 초대장/ }));

    const inspector = getScenePropertiesPanel();
    expect(within(inspector).getByText("선택한 연결 대상")).toBeDefined();
    expect(within(inspector).getByText("찢어진 초대장")).toBeDefined();
  });

  it("테마가 바뀌면 이전 테마의 선택 항목을 초기화한다", () => {
    const { rerender } = render(<StoryMapWorkspace themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: /찢어진 초대장/ }));
    expect(within(getScenePropertiesPanel()).getByText("찢어진 초대장")).toBeDefined();

    rerender(<StoryMapWorkspace themeId="theme-2" />);

    expect(within(getScenePropertiesPanel()).queryByText("찢어진 초대장")).toBeNull();
    expect(
      within(getScenePropertiesPanel()).getByText(
        "왼쪽 라이브러리에서 항목을 선택하면 장면에 붙일 연결 대상으로 표시합니다.",
      ),
    ).toBeDefined();
  });
});
