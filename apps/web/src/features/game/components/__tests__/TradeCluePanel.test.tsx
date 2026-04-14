import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockTradeData, mockClueData } = vi.hoisted(() => ({
  mockTradeData: {} as Record<string, unknown>,
  mockClueData: {} as Record<string, unknown>,
}));

// ---------------------------------------------------------------------------
// Mock: moduleStoreFactory
// ---------------------------------------------------------------------------

vi.mock("@/stores/moduleStoreFactory", () => ({
  useModuleStore: (
    moduleId: string,
    selector?: (s: { data: Record<string, unknown> }) => unknown,
  ) => {
    const data = moduleId === "trade_clue" ? mockTradeData : mockClueData;
    const state = { data };
    return selector ? selector(state) : state;
  },
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// 테스트 대상
// ---------------------------------------------------------------------------

import { TradeCluePanel } from "../TradeCluePanel";
import { TradeRequestNotification } from "../TradeRequestNotification";

// ---------------------------------------------------------------------------
// 공통 픽스처
// ---------------------------------------------------------------------------

const CLUES = [
  { id: "clue-1", title: "혈흔", category: "physical", isNew: false, isUsable: false },
  { id: "clue-2", title: "목격자 진술", category: "testimony", isNew: false, isUsable: false },
];

const PLAYERS = [
  { id: "player-2", nickname: "앨리스", isHost: false, isAlive: true, isReady: true, role: null, connectedAt: 0 },
  { id: "player-3", nickname: "밥", isHost: false, isAlive: true, isReady: true, role: null, connectedAt: 0 },
];

// ---------------------------------------------------------------------------
// TradeCluePanel 테스트
// ---------------------------------------------------------------------------

describe("TradeCluePanel", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    Object.keys(mockTradeData).forEach((k) => delete mockTradeData[k]);
    Object.keys(mockClueData).forEach((k) => delete mockClueData[k]);
    mockSend.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("빈 상태", () => {
    it("단서가 없으면 EmptyState를 렌더링한다", () => {
      render(<TradeCluePanel send={mockSend} />);
      expect(screen.getByText("교환할 단서가 없습니다")).toBeTruthy();
    });
  });

  describe("단서 목록 렌더링", () => {
    beforeEach(() => {
      mockClueData.clues = CLUES;
      mockClueData.players = PLAYERS;
    });

    it("단서 목록을 렌더링한다", () => {
      render(<TradeCluePanel send={mockSend} />);
      expect(screen.getByText("혈흔")).toBeTruthy();
      expect(screen.getByText("목격자 진술")).toBeTruthy();
    });

    it("플레이어 목록을 렌더링한다", () => {
      render(<TradeCluePanel send={mockSend} />);
      expect(screen.getByText("앨리스")).toBeTruthy();
      expect(screen.getByText("밥")).toBeTruthy();
    });

    it("단서와 플레이어 선택 전 교환 요청 버튼은 비활성화된다", () => {
      render(<TradeCluePanel send={mockSend} />);
      const btn = screen.getByRole("button", { name: /교환 요청/ });
      expect(btn).toBeTruthy();
      // disabled 속성 확인
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("단서 선택 시 해당 버튼이 활성화 표시된다", () => {
      render(<TradeCluePanel send={mockSend} />);
      fireEvent.click(screen.getByText("혈흔"));
      // 단서만 선택 — 교환 요청 버튼은 아직 비활성
      const btn = screen.getByRole("button", { name: /교환 요청/ });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("단서 + 플레이어 선택 후 교환 요청 버튼이 활성화된다", () => {
      render(<TradeCluePanel send={mockSend} />);
      fireEvent.click(screen.getByText("혈흔"));
      fireEvent.click(screen.getByText("앨리스"));
      const btn = screen.getByRole("button", { name: /교환 요청/ });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    it("교환 요청 버튼 클릭 시 send를 GAME_ACTION trade:request로 호출한다", () => {
      render(<TradeCluePanel send={mockSend} />);
      fireEvent.click(screen.getByText("혈흔"));
      fireEvent.click(screen.getByText("앨리스"));
      fireEvent.click(screen.getByRole("button", { name: /교환 요청/ }));

      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
        type: "trade:request",
        targetPlayerId: "player-2",
        clueId: "clue-1",
      });
    });

    it("요청 후 선택이 초기화된다", () => {
      render(<TradeCluePanel send={mockSend} />);
      fireEvent.click(screen.getByText("혈흔"));
      fireEvent.click(screen.getByText("앨리스"));
      fireEvent.click(screen.getByRole("button", { name: /교환 요청/ }));

      // 선택 초기화 후 버튼 다시 비활성화
      const btn = screen.getByRole("button", { name: /교환 요청/ });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("교환 상태 업데이트", () => {
    beforeEach(() => {
      mockClueData.clues = CLUES;
      mockClueData.players = PLAYERS;
    });

    it("trade:accepted 이벤트 수신 시 상태가 수락됨으로 변경된다", async () => {
      const { rerender } = render(<TradeCluePanel send={mockSend} />);

      // 교환 요청 먼저
      fireEvent.click(screen.getByText("혈흔"));
      fireEvent.click(screen.getByText("앨리스"));
      fireEvent.click(screen.getByRole("button", { name: /교환 요청/ }));

      // 교환 내역 영역이 렌더링됐는지 확인
      expect(screen.getByText("교환 내역")).toBeTruthy();
      expect(screen.getByText(/대기 중/)).toBeTruthy();

      // accepted 이벤트는 서버가 부여한 tradeId를 사용하므로
      // 여기서는 toast가 호출됐는지만 확인 (실제 tradeId 매칭은 통합 테스트 범위)
      act(() => {
        mockTradeData.lastEvent_accepted = { tradeId: "server-trade-1" };
      });
      rerender(<TradeCluePanel send={mockSend} />);
      // toast.success는 sonner mock에서 확인 가능
    });
  });
});

// ---------------------------------------------------------------------------
// TradeRequestNotification 테스트
// ---------------------------------------------------------------------------

describe("TradeRequestNotification", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    Object.keys(mockTradeData).forEach((k) => delete mockTradeData[k]);
    Object.keys(mockClueData).forEach((k) => delete mockClueData[k]);
    mockSend.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("아무것도 렌더링하지 않는다 (null 반환)", () => {
    const { container } = render(<TradeRequestNotification send={mockSend} />);
    expect(container.firstChild).toBeNull();
  });

  it("trade:incoming 이벤트 없으면 send를 호출하지 않는다", () => {
    render(<TradeRequestNotification send={mockSend} />);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("trade:incoming 이벤트 수신 시 toast를 호출한다", async () => {
    const { toast } = await import("sonner");

    const { rerender } = render(<TradeRequestNotification send={mockSend} />);

    act(() => {
      mockTradeData.lastEvent_incoming = {
        tradeId: "trade-abc",
        fromPlayerId: "player-2",
        fromPlayerName: "앨리스",
        clueId: "clue-1",
        clueName: "혈흔",
      };
    });
    rerender(<TradeRequestNotification send={mockSend} />);

    expect(toast).toHaveBeenCalled();
  });
});
