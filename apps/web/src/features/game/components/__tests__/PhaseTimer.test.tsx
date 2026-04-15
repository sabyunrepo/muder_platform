import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock @mmp/game-logic timer utilities
// ---------------------------------------------------------------------------

let mockRemainingMs = 120_000; // default: 2 minutes remaining

vi.mock("@mmp/game-logic", () => ({
  getRemainingTime: (_deadline: number) => mockRemainingMs,
  formatRemainingTime: (_deadline: number) => {
    const s = Math.max(0, Math.floor(mockRemainingMs / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  },
}));

// Import AFTER mocks.
import { PhaseTimer } from "../PhaseTimer";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRemainingMs = 120_000;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PhaseTimer", () => {
  it("renders nothing when deadlineMs is null", () => {
    const { container } = render(<PhaseTimer deadlineMs={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the formatted time when deadlineMs is provided", () => {
    render(<PhaseTimer deadlineMs={Date.now() + 120_000} />);
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.getByText("2:00")).toBeTruthy();
  });

  it("uses normal (white) colour when >60s remaining", () => {
    mockRemainingMs = 90_000; // 90s
    render(<PhaseTimer deadlineMs={Date.now() + 90_000} />);
    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("text-slate-200");
  });

  it("uses amber colour when ≤60s and >10s remaining", () => {
    mockRemainingMs = 45_000; // 45s
    render(<PhaseTimer deadlineMs={Date.now() + 45_000} />);
    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("text-amber-400");
    expect(timer.className).not.toContain("text-red-400");
  });

  it("uses red + pulse when ≤10s remaining", () => {
    mockRemainingMs = 8_000; // 8s
    render(<PhaseTimer deadlineMs={Date.now() + 8_000} />);
    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("text-red-400");
    expect(timer.className).toContain("animate-pulse");
  });

  it("has aria-live=assertive when ≤10s", () => {
    mockRemainingMs = 5_000;
    render(<PhaseTimer deadlineMs={Date.now() + 5_000} />);
    expect(screen.getByRole("timer").getAttribute("aria-live")).toBe("assertive");
  });

  it("has aria-live=polite when >10s", () => {
    mockRemainingMs = 30_000;
    render(<PhaseTimer deadlineMs={Date.now() + 30_000} />);
    expect(screen.getByRole("timer").getAttribute("aria-live")).toBe("polite");
  });
});
