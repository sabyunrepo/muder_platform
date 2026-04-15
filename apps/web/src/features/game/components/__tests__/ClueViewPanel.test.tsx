import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockModuleData } = vi.hoisted(() => ({
  mockModuleData: {} as Record<string, unknown>,
}));

// ---------------------------------------------------------------------------
// Mock: moduleStoreFactory
// ---------------------------------------------------------------------------

vi.mock("@/stores/moduleStoreFactory", () => ({
  useModuleStore: (
    _moduleId: string,
    selector?: (s: { data: Record<string, unknown> }) => unknown,
  ) => {
    const state = { data: mockModuleData };
    return selector ? selector(state) : state;
  },
}));

// ---------------------------------------------------------------------------
// 테스트 대상
// ---------------------------------------------------------------------------

import { ClueViewPanel } from "../ClueViewPanel";

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

const CLUES = [
  {
    id: "clue-1",
    title: "혈흔",
    description: "바닥에 떨어진 혈흔이 발견되었습니다",
    category: "physical",
    locationName: "서재",
    isNew: true,
    isShared: false,
  },
  {
    id: "clue-2",
    title: "목격자 진술",
    description: "밤 11시에 비명 소리를 들었다는 증언",
    category: "testimony",
    locationName: "복도",
    isNew: false,
    isShared: true,
  },
];

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe("ClueViewPanel", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    Object.keys(mockModuleData).forEach((k) => delete mockModuleData[k]);
    mockSend.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("단서가 없으면 EmptyState를 렌더링한다", () => {
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    expect(screen.getByText("획득한 단서가 없습니다")).toBeTruthy();
  });

  it("단서 목록을 렌더링한다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    expect(screen.getByText("혈흔")).toBeTruthy();
    expect(screen.getByText("목격자 진술")).toBeTruthy();
  });

  it("헤더에 단서 개수를 표시한다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    expect(screen.getByText("2개")).toBeTruthy();
  });

  it("단서 카드 클릭 시 인라인 상세를 표시한다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    fireEvent.click(screen.getByText("혈흔"));
    // 인라인 상세 패널의 <h4> 제목이 나타나야 함
    expect(screen.getByRole("heading", { level: 4, name: "혈흔" })).toBeTruthy();
  });

  it("상세 닫기 버튼 클릭 시 상세가 사라진다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    // 단서 카드 클릭 → 상세 패널 오픈
    fireEvent.click(screen.getByText("혈흔"));
    // 상세 패널 내 <h4>가 존재하는지 확인
    expect(screen.getByRole("heading", { level: 4, name: "혈흔" })).toBeTruthy();
    // 닫기 버튼 클릭 → 상세 패널 제거
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    // 인라인 상세 패널의 <h4>가 사라졌는지 확인
    expect(screen.queryByRole("heading", { level: 4, name: "혈흔" })).toBeNull();
  });

  it("공유 버튼 클릭 시 GAME_ACTION clue:share를 전송한다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    // 첫 번째 단서(혈흔)는 isShared=false → 공유 버튼 표시
    const shareBtn = screen.getAllByRole("button", { name: /공유/ })[0];
    fireEvent.click(shareBtn);
    expect(mockSend).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
      type: "clue:share",
      clueId: "clue-1",
    });
  });

  it("isShared=true인 단서는 공유 버튼 대신 '공유됨' 텍스트를 표시한다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    // 두 번째 단서는 isShared=true
    expect(screen.getAllByText("공유됨").length).toBeGreaterThan(0);
  });

  it("공유 후 해당 단서의 공유 버튼이 비활성화된다", () => {
    mockModuleData.clues = [{ ...CLUES[0] }];
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    const shareBtn = screen.getByRole("button", { name: /공유/ });
    fireEvent.click(shareBtn);
    // 공유 후 '공유됨' 표시로 전환
    expect(screen.getByText("공유됨")).toBeTruthy();
  });

  it("단서 헤더에 '단서 열람' 제목을 표시한다", () => {
    mockModuleData.clues = CLUES;
    render(<ClueViewPanel send={mockSend} moduleId="clue_view" />);
    expect(screen.getByText("단서 열람")).toBeTruthy();
  });
});
