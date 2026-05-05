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

vi.mock("@/features/editor/api", () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useEditorClues: () => useEditorCluesMock(),
  useEditorLocations: () => useEditorLocationsMock(),
}));

vi.mock("@/features/editor/mediaApi", () => ({
  useMediaList: () => useMediaListMock(),
}));

import { EditorEntityLibrary, type StoryLibraryEntity } from "../EditorEntityLibrary";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  useEditorCharactersMock.mockReturnValue({
    data: [
      { id: "char-1", name: "한서윤", is_playable: true },
      { id: "char-2", name: "집사", is_playable: false },
    ],
    isLoading: false,
    isError: false,
  });
  useEditorCluesMock.mockReturnValue({
    data: [
      { id: "clue-1", name: "찢어진 초대장", location_id: null },
      { id: "clue-2", name: "피 묻은 장갑", location_id: "loc-1" },
    ],
    isLoading: false,
    isError: false,
  });
  useEditorLocationsMock.mockReturnValue({
    data: [{ id: "loc-1", name: "응접실", from_round: 0, until_round: null }],
    isLoading: false,
    isError: false,
  });
  useMediaListMock.mockReturnValue({
    data: [{ id: "media-1", name: "오프닝 음악", type: "BGM" }],
    isLoading: false,
    isError: false,
  });
});

describe("EditorEntityLibrary", () => {
  it("기존 editor API 목록을 제작자용 라이브러리로 표시한다", () => {
    render(<EditorEntityLibrary themeId="theme-1" onSelectEntity={vi.fn()} />);

    expect(screen.getByText("한서윤")).toBeDefined();
    expect(screen.getByText("집사")).toBeDefined();
    expect(screen.getByText("찢어진 초대장")).toBeDefined();
    expect(screen.getByText("피 묻은 장갑")).toBeDefined();
    expect(screen.getByText("응접실")).toBeDefined();
    expect(screen.getByText("공개 구간 있음")).toBeDefined();
    expect(screen.getByText("오프닝 음악")).toBeDefined();
    expect(screen.getByText("조사권")).toBeDefined();
    expect(screen.getByText("토론방")).toBeDefined();
    expect(screen.getByText("트리거")).toBeDefined();
  });

  it("항목을 누르면 연결 대상으로 선택 이벤트를 보낸다", () => {
    const onSelectEntity = vi.fn();
    render(<EditorEntityLibrary themeId="theme-1" onSelectEntity={onSelectEntity} />);

    fireEvent.click(screen.getByRole("button", { name: /피 묻은 장갑/ }));

    expect(onSelectEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "clue-2",
        kind: "clue",
        title: "피 묻은 장갑",
      }),
    );
  });

  it("선택된 항목은 aria-pressed로 상태를 노출한다", () => {
    const selectedEntity: StoryLibraryEntity = {
      id: "clue-1",
      kind: "clue",
      title: "찢어진 초대장",
      detail: "공통 단서",
      section: "단서",
      connectable: true,
    };

    render(
      <EditorEntityLibrary
        themeId="theme-1"
        selectedEntity={selectedEntity}
        onSelectEntity={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /찢어진 초대장/ }).getAttribute("aria-pressed"))
      .toBe("true");
  });

  it("목록이 비어 있으면 빈 상태를 보여준다", () => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useMediaListMock.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<EditorEntityLibrary themeId="theme-1" onSelectEntity={vi.fn()} />);

    expect(screen.getAllByText("아직 등록된 항목이 없습니다.").length).toBe(4);
  });

  it("목록을 불러오는 동안 로딩 상태를 보여준다", () => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: true, isError: false });
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: true, isError: false });
    useEditorLocationsMock.mockReturnValue({ data: [], isLoading: true, isError: false });
    useMediaListMock.mockReturnValue({ data: [], isLoading: true, isError: false });

    render(<EditorEntityLibrary themeId="theme-1" onSelectEntity={vi.fn()} />);

    expect(screen.getAllByText("목록을 불러오는 중입니다.").length).toBe(4);
  });

  it("목록 조회에 실패하면 오류 상태를 보여준다", () => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: false, isError: true });
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false, isError: true });
    useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false, isError: true });
    useMediaListMock.mockReturnValue({ data: [], isLoading: false, isError: true });

    render(<EditorEntityLibrary themeId="theme-1" onSelectEntity={vi.fn()} />);

    expect(screen.getAllByText("목록을 불러오지 못했습니다.").length).toBe(4);
  });
});
