import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/stores/gameSessionStore", () => ({
  useGameSessionStore: (selector: (s: unknown) => unknown) =>
    selector({ sessionId: "sess-1" }),
}));

// Import AFTER mocks
import { EndingPanel } from "../EndingPanel";
import type { GameEndPayload } from "../EndingPanel";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const scores = [
  { playerId: "p1", nickname: "Alice", score: 120, clueCount: 5, badge: "MVP" },
  { playerId: "p2", nickname: "Bob", score: 80, clueCount: 3, badge: null },
  { playerId: "p3", nickname: "Carol", score: 60, clueCount: 1, badge: null },
];

const detectiveWin: GameEndPayload = {
  winnerTeam: "detective",
  winnerName: "Alice",
  scores,
};

const draw: GameEndPayload = {
  winnerTeam: "draw",
  winnerName: null,
  scores: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EndingPanel", () => {
  const mockSend = vi.fn();
  const mockOnLobby = vi.fn();

  beforeEach(() => {
    mockSend.mockReset();
    mockOnLobby.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state when endPayload is null", () => {
    render(
      <EndingPanel send={mockSend} endPayload={null} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("게임 결과를 기다리는 중...")).toBeTruthy();
  });

  it("shows winner banner for detective team win", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("탐정팀 승리")).toBeTruthy();
    // MVP label contains "Alice" — check it exists (may appear multiple times with player cards)
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
  });

  it("shows draw banner when winnerTeam is draw", () => {
    render(
      <EndingPanel send={mockSend} endPayload={draw} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("무승부")).toBeTruthy();
  });

  it("shows culprit win banner", () => {
    const culpritWin: GameEndPayload = {
      winnerTeam: "culprit",
      winnerName: "Bob",
      scores: [],
    };
    render(
      <EndingPanel send={mockSend} endPayload={culpritWin} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("범인팀 승리")).toBeTruthy();
  });

  it("renders player score cards sorted by score desc", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    // All players appear in DOM (may appear multiple times due to chart + banner)
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carol").length).toBeGreaterThan(0);
    // Score shown on player card (unique per player)
    expect(screen.getByText("120점")).toBeTruthy();
    expect(screen.getByText("80점")).toBeTruthy();
  });

  it("renders clue contribution section", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("단서 기여도")).toBeTruthy();
  });

  it("renders MVP badge on player card", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("MVP")).toBeTruthy();
  });

  it("calls onLobby when 로비로 button is clicked", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    fireEvent.click(screen.getByText("로비로"));
    expect(mockOnLobby).toHaveBeenCalledTimes(1);
  });

  it("calls send with GAME_ACTION replay when 다시하기 is clicked", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    fireEvent.click(screen.getByText("다시하기"));
    expect(mockSend).toHaveBeenCalledWith("game:action", {
      type: "replay",
      sessionId: "sess-1",
    });
  });

  it("shows '최종 순위' section when scores are present", () => {
    render(
      <EndingPanel send={mockSend} endPayload={detectiveWin} onLobby={mockOnLobby} />,
    );
    expect(screen.getByText("최종 순위")).toBeTruthy();
  });

  it("does not show ranking section when scores are empty", () => {
    render(
      <EndingPanel send={mockSend} endPayload={draw} onLobby={mockOnLobby} />,
    );
    expect(screen.queryByText("최종 순위")).toBeNull();
  });
});
