import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GamePhase } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Mock @mmp/game-logic — deterministic values for tests
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
}));

// Import AFTER mocks are set up.
import { PhaseBar } from "../PhaseBar";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => cleanup());

describe("PhaseBar", () => {
  it("renders nothing when phase is null", () => {
    const { container } = render(<PhaseBar phase={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("marks the active phase chip with aria-current=step", () => {
    render(<PhaseBar phase={GamePhase.INVESTIGATION} />);
    const activeChip = screen.getByText("탐색");
    expect(activeChip.getAttribute("aria-current")).toBe("step");
  });

  it("renders all 7 phase chips", () => {
    render(<PhaseBar phase={GamePhase.LOBBY} />);
    const phaseLabels = ["로비", "소개", "탐색", "토론", "투표", "공개", "결과"];
    for (const label of phaseLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("shows the round badge", () => {
    render(<PhaseBar phase={GamePhase.VOTING} round={3} />);
    expect(screen.getByText("R3")).toBeTruthy();
  });

  it("defaults to round 1 when round prop is omitted", () => {
    render(<PhaseBar phase={GamePhase.LOBBY} />);
    expect(screen.getByText("R1")).toBeTruthy();
  });

  it("renders a progressbar with correct aria-valuenow", () => {
    // investigation is index 2, total 7 → (3/7)*100 ≈ 42.86
    render(<PhaseBar phase={GamePhase.INVESTIGATION} />);
    const bar = screen.getByRole("progressbar");
    const value = Number(bar.getAttribute("aria-valuenow"));
    expect(value).toBeCloseTo(42.86, 1);
  });

  it("active chip has phase-specific colour class", () => {
    render(<PhaseBar phase={GamePhase.VOTING} />);
    const chip = screen.getByText("투표");
    // bg-purple-600 is the colour for VOTING in PHASE_COLOR
    expect(chip.className).toContain("bg-purple-600");
  });

  it("past phases have muted colour class", () => {
    render(<PhaseBar phase={GamePhase.VOTING} />);
    // 로비 (index 0) is before 투표 (index 4)
    const lobbyChip = screen.getByText("로비");
    expect(lobbyChip.className).toContain("bg-slate-700");
  });

  it("future phases have dimmed colour class", () => {
    render(<PhaseBar phase={GamePhase.LOBBY} />);
    // 결과 (index 6) is after 로비 (index 0)
    const resultChip = screen.getByText("결과");
    expect(resultChip.className).toContain("bg-slate-800");
  });
});
