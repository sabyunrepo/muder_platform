import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GamePhase } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Mock @mmp/game-logic
// ---------------------------------------------------------------------------

vi.mock("@mmp/game-logic", () => ({
  getPhaseIndex: (phase: string) => {
    const order = [
      "lobby",
      "intro",
      "investigation",
      "discussion",
      "voting",
      "reveal",
      "result",
    ];
    return order.indexOf(phase);
  },
  getPhaseCount: () => 7,
  getRemainingTime: (_deadline: number) => 90_000,
  formatRemainingTime: (_deadline: number) => "1:30",
}));

// Import AFTER mocks.
import { GameLayout } from "../GameLayout";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => cleanup());

describe("GameLayout", () => {
  it("renders children inside main", () => {
    render(
      <GameLayout phase={GamePhase.LOBBY}>
        <p>content here</p>
      </GameLayout>,
    );
    expect(screen.getByText("content here")).toBeTruthy();
  });

  it("renders PhaseBar when phase is provided", () => {
    render(
      <GameLayout phase={GamePhase.INVESTIGATION}>
        <span>body</span>
      </GameLayout>,
    );
    // PhaseBar renders the active chip with aria-current=step
    expect(screen.getByText("탐색").getAttribute("aria-current")).toBe("step");
  });

  it("does not render timer when deadlineMs is omitted", () => {
    render(
      <GameLayout phase={GamePhase.LOBBY}>
        <span />
      </GameLayout>,
    );
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("renders PhaseTimer when deadlineMs is provided", () => {
    render(
      <GameLayout phase={GamePhase.INVESTIGATION} deadlineMs={Date.now() + 90_000}>
        <span />
      </GameLayout>,
    );
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.getByText("1:30")).toBeTruthy();
  });

  it("renders footer slot when provided", () => {
    render(
      <GameLayout phase={GamePhase.LOBBY} footer={<div>my footer</div>}>
        <span />
      </GameLayout>,
    );
    expect(screen.getByText("my footer")).toBeTruthy();
  });

  it("does not render footer element when footer prop is omitted", () => {
    const { container } = render(
      <GameLayout phase={GamePhase.LOBBY}>
        <span />
      </GameLayout>,
    );
    expect(container.querySelector("footer")).toBeNull();
  });

  it("passes round to PhaseBar", () => {
    render(
      <GameLayout phase={GamePhase.VOTING} round={5}>
        <span />
      </GameLayout>,
    );
    expect(screen.getByText("R5")).toBeTruthy();
  });
});
