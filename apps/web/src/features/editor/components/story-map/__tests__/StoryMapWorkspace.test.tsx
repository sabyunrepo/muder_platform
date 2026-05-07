import { cleanup, render, screen } from "@testing-library/react";
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
  FlowCanvas: ({ themeId }: { themeId: string }) => <div data-testid="flow-canvas">flow canvas {themeId}</div>,
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
      data: [
        { id: "clue-1", name: "찢어진 초대장", location_id: "loc-1", reveal_round: 1, hide_round: 2 },
        { id: "clue-2", name: "봉인된 유언장", location_id: "loc-1", reveal_round: 3, hide_round: 3 },
      ],
      isLoading: false,
      isError: false,
    });
    useEditorLocationsMock.mockReturnValue({
      data: [{ id: "loc-1", name: "응접실", from_round: 1, until_round: 2 }],
      isLoading: false,
      isError: false,
    });
    useMediaListMock.mockReturnValue({
      data: [{ id: "media-1", name: "오프닝 음악", type: "BGM" }],
      isLoading: false,
      isError: false,
    });
  });

  it("게임 진행 플로우 중심 제작 화면과 플로우 캔버스를 함께 렌더링한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    expect(screen.getByLabelText("게임 진행 플로우").className).toContain("lg:overflow-hidden");
    expect(screen.getByRole("heading", { name: "게임 진행 플로우" })).toBeDefined();
    expect(screen.getByText("Game Flow")).toBeDefined();
    expect(screen.getByText("진행 단계")).toBeDefined();
    expect(screen.getByText("라운드")).toBeDefined();
    expect(screen.getByText("투표")).toBeDefined();
    expect(screen.getByText("엔딩")).toBeDefined();
    expect(screen.getByTestId("flow-canvas").textContent).toContain("theme-1");
  });

  it("상단 라운드 미리보기와 좌우 보조 패널을 렌더링하지 않는다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    expect(screen.queryByRole("heading", { name: "라운드 공개 미리보기" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "제작 라이브러리" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "장면 속성" })).toBeNull();
    expect(screen.queryByText("찢어진 초대장")).toBeNull();
    expect(screen.queryByText("오프닝 음악")).toBeNull();
  });

  it("중앙 캔버스를 단일 주 작업 영역으로 넓게 배치한다", () => {
    render(<StoryMapWorkspace themeId="theme-1" />);

    const main = screen.getByTestId("flow-canvas").closest("main");
    expect(main?.className).toContain("flex-1");
    expect(main?.className).toContain("overflow-hidden");
    expect(main?.className).not.toContain("lg:border-l");
  });
});
