import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetActiveTab = vi.fn();
const mockNavigate = vi.fn();
const mockActiveTab = { current: "storyMap" };

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../stores/editorUIStore", () => ({
  useEditorUI: () => ({
    activeTab: mockActiveTab.current,
    setActiveTab: mockSetActiveTab,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { EditorTabNav } from "../EditorTabNav";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockActiveTab.current = "storyMap";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditorTabNav dynamic tabs", () => {
  it("선택된 탭을 모바일 가로 탭바 중앙으로 자동 스크롤한다", () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    mockActiveTab.current = "media";

    render(<EditorTabNav activeModules={[]} />);

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "center",
    });
  });

  it("모듈 미지정 시 always=true 탭만 표시된다", () => {
    render(<EditorTabNav />);
    expect(screen.getByText("스토리 진행")).toBeDefined();
    expect(screen.getByText("정보 관리")).toBeDefined();
    expect(screen.getByText("읽기 대사")).toBeDefined();
    expect(screen.getByText("등장인물 관리")).toBeDefined();
    expect(screen.getByText("단서 관리")).toBeDefined();
    expect(screen.getByText("게임 설계")).toBeDefined();
    expect(screen.getByText("미디어 관리")).toBeDefined();
    expect(screen.getByText("기본 설정")).toBeDefined();
    expect(screen.getByText("고급 설정")).toBeDefined();
  });

  it("미디어 탭은 voice_chat 모듈 없이도 표시된다", () => {
    render(<EditorTabNav activeModules={["text_chat"]} />);
    expect(screen.getByText("미디어 관리")).toBeDefined();
  });

  it("직접 URL로 열린 미디어 탭은 기본 노출 탭으로 유지된다", () => {
    mockActiveTab.current = "media";
    render(<EditorTabNav activeModules={[]} forcedVisibleTab="media" />);

    expect(screen.getByText("미디어 관리")).toBeDefined();
    expect(mockSetActiveTab).not.toHaveBeenCalledWith("storyMap");
  });

  it("현재 미디어 탭은 모듈이 없어도 숨겨지지 않는다", () => {
    mockActiveTab.current = "media";
    render(<EditorTabNav activeModules={[]} />);

    expect(screen.getByText("미디어 관리")).toBeDefined();
  });

  it("스토리 진행, 보조 관리, 설정 순서로 탭 우선순위를 유지한다", () => {
    render(<EditorTabNav activeModules={["voice_chat"]} />);

    const tabLabels = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabLabels).toEqual([
      "스토리 진행",
      "정보 관리",
      "읽기 대사",
      "등장인물 관리",
      "단서 관리",
      "게임 설계",
      "미디어 관리",
      "기본 설정",
      "템플릿",
      "고급 설정",
    ]);
  });

  it("탭 클릭 시 제작자가 다시 열 수 있는 canonical URL로 이동한다", () => {
    render(<EditorTabNav themeId="theme-1" activeModules={["voice_chat"]} />);

    fireEvent.click(screen.getByRole("tab", { name: /등장인물 관리/ }));

    expect(mockSetActiveTab).toHaveBeenCalledWith("characters");
    expect(mockNavigate).toHaveBeenCalledWith("/editor/theme-1/characters");
  });

  it("게임 설계 탭 클릭은 기본 설계 화면 URL로 이동한다", () => {
    render(<EditorTabNav themeId="theme-1" />);

    fireEvent.click(screen.getByRole("tab", { name: /게임 설계/ }));

    expect(mockSetActiveTab).toHaveBeenCalledWith("design");
    expect(mockNavigate).toHaveBeenCalledWith("/editor/theme-1/design/modules");
  });

  it("항상 표시되는 미디어 현재 탭은 스토리 진행 URL로 되돌리지 않는다", () => {
    mockActiveTab.current = "media";
    render(<EditorTabNav themeId="theme-1" activeModules={[]} />);

    expect(screen.getByText("미디어 관리")).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalledWith("/editor/theme-1");
  });
});
