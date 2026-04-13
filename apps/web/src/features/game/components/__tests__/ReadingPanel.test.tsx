import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { useReadingStore } from "@/stores/readingStore";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Stub ReadingOverlay (lazy-loaded in ReadingPanel) so Suspense resolves sync.
vi.mock("@/features/reading/ReadingOverlay", () => ({
  ReadingOverlay: ({
    isHost,
    onAdvance,
  }: {
    currentUserRole: string | null;
    isHost: boolean;
    onAdvance: () => void;
  }) => (
    <div data-testid="reading-overlay-stub">
      <span data-testid="is-host">{String(isHost)}</span>
      <button type="button" data-testid="advance-btn" onClick={onAdvance}>
        다음
      </button>
    </div>
  ),
}));

// Stub useReadingAdvance — return a controllable spy.
const mockOnAdvance = vi.fn();
vi.mock("@/features/audio/hooks/useReadingAdvance", () => ({
  useReadingAdvance: () => mockOnAdvance,
}));

// Stub useGameStore — default: non-host player with no role.
let mockIsHost = false;
let mockMyRole: string | null = null;

vi.mock("@/stores/gameStore", () => ({
  useGameStore: (selector: (s: unknown) => unknown) => {
    const fakeState = {
      myPlayerId: "player-1",
      myRole: mockMyRole,
      players: [
        {
          id: "player-1",
          isHost: mockIsHost,
          nickname: "Tester",
          role: mockMyRole,
          isAlive: true,
          isReady: true,
          connectedAt: 0,
        },
      ],
    };
    return selector(fakeState);
  },
  selectMyRole: (s: { myRole: string | null }) => s.myRole,
}));

// Import AFTER mocks are defined (vitest hoisting).
import { ReadingPanel } from "../ReadingPanel";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReadingPanel", () => {
  const noopSend = vi.fn();

  beforeEach(() => {
    useReadingStore.getState().clear();
    mockIsHost = false;
    mockMyRole = null;
    mockOnAdvance.mockReset();
    noopSend.mockReset();
  });

  afterEach(() => {
    cleanup();
    useReadingStore.getState().clear();
  });

  it("renders the placeholder when no reading section is active", () => {
    render(<ReadingPanel send={noopSend} />);

    expect(screen.getByText("사건 소개")).toBeTruthy();
    expect(screen.getByText("역할과 배경 스토리를 확인하세요")).toBeTruthy();
  });

  it("hides the placeholder once a reading section starts", async () => {
    render(<ReadingPanel send={noopSend} />);

    // Activate a section.
    act(() => {
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "서막입니다.", speaker: "Narrator", advanceBy: "gm" },
      ]);
    });

    // Placeholder should be gone.
    expect(screen.queryByText("역할과 배경 스토리를 확인하세요")).toBeNull();
  });

  it("renders ReadingOverlay (stub) when section is active", async () => {
    act(() => {
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "Hello", speaker: "GM", advanceBy: "gm" },
      ]);
    });

    render(<ReadingPanel send={noopSend} />);

    // Suspense resolves synchronously in test environment with a sync mock.
    expect(screen.getByTestId("reading-overlay-stub")).toBeTruthy();
  });

  it("advance button calls the onAdvance callback from useReadingAdvance", async () => {
    act(() => {
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "Hello", speaker: "GM", advanceBy: "gm" },
      ]);
    });

    render(<ReadingPanel send={noopSend} />);

    const btn = screen.getByTestId("advance-btn");
    fireEvent.click(btn);

    expect(mockOnAdvance).toHaveBeenCalledTimes(1);
  });

  it("passes isHost=true to ReadingOverlay when player is host", async () => {
    mockIsHost = true;

    act(() => {
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "Host line", speaker: "GM", advanceBy: "gm" },
      ]);
    });

    render(<ReadingPanel send={noopSend} />);

    expect(screen.getByTestId("is-host").textContent).toBe("true");
  });

  it("passes isHost=false to ReadingOverlay when player is not host", async () => {
    mockIsHost = false;

    act(() => {
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "Player line", speaker: "GM", advanceBy: "gm" },
      ]);
    });

    render(<ReadingPanel send={noopSend} />);

    expect(screen.getByTestId("is-host").textContent).toBe("false");
  });

  it("hides placeholder again when section completes", async () => {
    // Start then complete.
    act(() => {
      useReadingStore.getState().startSection("sec-1", [
        { index: 0, text: "Done", speaker: "GM", advanceBy: "gm" },
      ]);
    });
    act(() => {
      useReadingStore.getState().completeSection();
    });

    render(<ReadingPanel send={noopSend} />);

    // Completed → placeholder shown again.
    expect(screen.getByText("사건 소개")).toBeTruthy();
  });
});
