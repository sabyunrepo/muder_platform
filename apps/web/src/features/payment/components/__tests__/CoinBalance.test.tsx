import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useAuthStore } from "@/stores/authStore";

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
  useBalance: (options?: { enabled?: boolean }) => useBalanceMock(options),
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
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoinBalance", () => {
  it("base + bonus 합계를 포매팅하여 렌더링한다", () => {
    useAuthStore.setState({ isAuthenticated: true });
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
    useAuthStore.setState({ isAuthenticated: true });
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

  it("비로그인 상태에서는 잔액 API를 비활성화하고 로그인 이동을 제공한다", () => {
    useBalanceMock.mockReturnValue({
      data: undefined,
    });

    render(
      <MemoryRouter>
        <CoinBalance />
      </MemoryRouter>,
    );

    expect(useBalanceMock).toHaveBeenCalledWith({ enabled: false });
    fireEvent.click(screen.getByText("로그인하면 잔액을 볼 수 있어요"));
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});
