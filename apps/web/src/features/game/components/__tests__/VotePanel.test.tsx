import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockModuleData, mockPlayers, mockMyPlayerId } = vi.hoisted(() => ({
  mockModuleData: {} as Record<string, unknown>,
  mockPlayers: [] as Array<{ id: string; nickname: string; isAlive: boolean; isHost: boolean; isReady: boolean; role: null; connectedAt: number }>,
  mockMyPlayerId: "player-1",
}));

// ---------------------------------------------------------------------------
// Mock: gameStore
// ---------------------------------------------------------------------------

vi.mock("@/stores/gameSessionStore", () => ({
  useGameSessionStore: (selector: (s: unknown) => unknown) => {
    const state = {
      players: mockPlayers,
      myPlayerId: mockMyPlayerId,
    };
    return selector(state);
  },
}));

vi.mock("@/stores/gameSelectors", () => ({
  selectAlivePlayers: (s: { players: Array<{ isAlive: boolean }> }) =>
    s.players.filter((p) => p.isAlive),
  selectMyPlayerId: (s: { myPlayerId: string }) => s.myPlayerId,
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
// Mock: useCountUp (VoteResultChart 의존) — 절대 경로 사용
// ---------------------------------------------------------------------------

vi.mock("@/features/game/hooks/useCountUp", () => ({
  useCountUp: (value: number) => value,
}));

// ---------------------------------------------------------------------------
// 테스트 대상
// ---------------------------------------------------------------------------

import { VotePanel } from "../VotePanel";

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

const PLAYERS = [
  { id: "player-1", nickname: "나", isAlive: true, isHost: true, isReady: true, role: null, connectedAt: 0 },
  { id: "player-2", nickname: "앨리스", isAlive: true, isHost: false, isReady: true, role: null, connectedAt: 0 },
  { id: "player-3", nickname: "밥", isAlive: true, isHost: false, isReady: true, role: null, connectedAt: 0 },
];

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe("VotePanel", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    Object.keys(mockModuleData).forEach((k) => delete mockModuleData[k]);
    mockPlayers.length = 0;
    mockPlayers.push(...PLAYERS);
    mockSend.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("헤더에 투표 아이콘과 제목을 렌더링한다", () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByRole("heading", { name: "투표" })).toBeTruthy();
  });

  it("자신을 제외한 생존 플레이어 목록을 렌더링한다", () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText("앨리스")).toBeTruthy();
    expect(screen.getByText("밥")).toBeTruthy();
    expect(screen.queryByText("나")).toBeNull();
  });

  it("투표 버튼 클릭 시 GAME_ACTION vote를 전송한다", () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    const btns = screen.getAllByRole("button", { name: /투표/ });
    fireEvent.click(btns[0]);
    expect(mockSend).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
      type: "vote",
      targetId: "player-2",
    });
  });

  it("투표 후 같은 버튼을 다시 클릭해도 send를 재호출하지 않는다", () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    const btns = screen.getAllByRole("button", { name: /투표/ });
    fireEvent.click(btns[0]);
    fireEvent.click(btns[0]);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("투표 완료 후 Badge '투표 완료'를 표시한다", () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    const btns = screen.getAllByRole("button", { name: /투표/ });
    fireEvent.click(btns[0]);
    expect(screen.getByText("투표 완료")).toBeTruthy();
  });

  it("results가 배열이면 투표 결과 차트를 렌더링한다", () => {
    mockModuleData.results = [
      { playerId: "player-2", nickname: "앨리스", votes: 3 },
      { playerId: "player-3", nickname: "밥", votes: 1 },
    ];
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText("투표 결과")).toBeTruthy();
    expect(screen.getByText("앨리스")).toBeTruthy();
    expect(screen.getByText("밥")).toBeTruthy();
  });

  it("results가 null이면 비밀 투표 안내를 표시한다", () => {
    mockModuleData.results = null;
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText(/비밀 투표/)).toBeTruthy();
  });

  it("생존 플레이어가 자신뿐이면 '투표 가능한 플레이어가 없습니다'를 표시한다", () => {
    mockPlayers.length = 0;
    mockPlayers.push({ id: "player-1", nickname: "나", isAlive: true, isHost: true, isReady: true, role: null, connectedAt: 0 });
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText("투표 가능한 플레이어가 없습니다")).toBeTruthy();
  });
});
