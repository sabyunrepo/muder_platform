import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useBalanceMock, navigateMock } = vi.hoisted(() => ({
  useBalanceMock: vi.fn(),
  navigateMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: react-router navigate
// ---------------------------------------------------------------------------

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>(
    "react-router",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ---------------------------------------------------------------------------
// Mock: @/features/coin/api
// ---------------------------------------------------------------------------

vi.mock("@/features/coin/api", () => ({
  useBalance: () => useBalanceMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CoinBalance } from "../CoinBalance";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoinBalance", () => {
  it("base + bonus 합계를 포매팅하여 렌더링한다", () => {
    useBalanceMock.mockReturnValue({
      data: { base_coins: 1200, bonus_coins: 300, total_coins: 1500 },
    });

    render(
      <MemoryRouter>
        <CoinBalance />
      </MemoryRouter>,
    );

    // 1200 + 300 = 1500 → "1,500"
    expect(screen.getByText("1,500")).toBeDefined();
    expect(
      screen.getByLabelText("코인 잔액 1,500개, 상점으로 이동"),
    ).toBeDefined();
  });

  it("클릭 시 /shop 으로 네비게이션한다", () => {
    useBalanceMock.mockReturnValue({
      data: { base_coins: 500, bonus_coins: 0, total_coins: 500 },
    });

    render(
      <MemoryRouter>
        <CoinBalance />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("500"));
    expect(navigateMock).toHaveBeenCalledWith("/shop");
  });
});
