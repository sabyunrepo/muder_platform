import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { usePackagesMock, navigateMock } = vi.hoisted(() => ({
  usePackagesMock: vi.fn(),
  navigateMock: vi.fn(),
}));

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
// Mock: @/features/payment/api
// ---------------------------------------------------------------------------

vi.mock("@/features/payment/api", () => ({
  usePackages: (platform?: string) => usePackagesMock(platform),
}));

// ---------------------------------------------------------------------------
// Mock: ./PaymentModal — stub out to detect open
// ---------------------------------------------------------------------------

vi.mock("../PaymentModal", () => ({
  PaymentModal: ({
    pkg,
    isOpen,
  }: {
    pkg: { name: string };
    isOpen: boolean;
  }) =>
    isOpen ? <div data-testid="payment-modal">{pkg.name}</div> : null,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CoinPackageList } from "../CoinPackageList";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPackages = [
  {
    id: "pkg-1",
    platform: "WEB" as const,
    name: "스타터 팩",
    price_krw: 5000,
    base_coins: 50,
    bonus_coins: 0,
    total_coins: 50,
  },
  {
    id: "pkg-2",
    platform: "WEB" as const,
    name: "프리미엄 팩",
    price_krw: 30000,
    base_coins: 300,
    bonus_coins: 50,
    total_coins: 350,
  },
  {
    id: "pkg-3",
    platform: "WEB" as const,
    name: "메가 팩",
    price_krw: 100000,
    base_coins: 1000,
    bonus_coins: 200,
    total_coins: 1200,
  },
];

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

describe("CoinPackageList", () => {
  it("로딩 중일 때 스피너를 표시한다", () => {
    usePackagesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<CoinPackageList />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("패키지 카드를 올바른 데이터로 렌더링한다", () => {
    usePackagesMock.mockReturnValue({
      data: mockPackages,
      isLoading: false,
    });

    render(<CoinPackageList />);

    // 패키지명
    expect(screen.getByText("스타터 팩")).toBeDefined();
    expect(screen.getByText("프리미엄 팩")).toBeDefined();
    expect(screen.getByText("메가 팩")).toBeDefined();

    // 가격 (toLocaleString("ko-KR"))
    expect(screen.getByText("5,000")).toBeDefined();
    expect(screen.getByText("30,000")).toBeDefined();
    expect(screen.getByText("100,000")).toBeDefined();

    // 코인 수
    expect(screen.getByText("50")).toBeDefined();
    expect(screen.getByText("350")).toBeDefined();
    expect(screen.getByText("1,200")).toBeDefined();
  });

  it("bonus > 0인 패키지에만 보너스 배지를 표시한다", () => {
    usePackagesMock.mockReturnValue({
      data: mockPackages,
      isLoading: false,
    });

    render(<CoinPackageList />);

    // 스타터 팩 (bonus=0) 에는 보너스 배지가 없어야 한다
    // 프리미엄 팩 (bonus=50), 메가 팩 (bonus=200) 에는 보너스 배지가 있어야 한다
    const bonusBadges = screen.getAllByText(/보너스 \+/);
    expect(bonusBadges.length).toBe(2);
    expect(screen.getByText("보너스 +50")).toBeDefined();
    expect(screen.getByText("보너스 +200")).toBeDefined();
  });

  it("카드 클릭 시 결제 모달을 연다", () => {
    useAuthStore.setState({ isAuthenticated: true });
    usePackagesMock.mockReturnValue({
      data: mockPackages,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <CoinPackageList />
      </MemoryRouter>,
    );

    // 모달이 아직 없어야 한다
    expect(screen.queryByTestId("payment-modal")).toBeNull();

    // 패키지 카드 클릭
    fireEvent.click(screen.getByText("프리미엄 팩"));

    // 모달이 나타나야 한다
    expect(screen.getByTestId("payment-modal")).toBeDefined();
    expect(screen.getByTestId("payment-modal").textContent).toBe("프리미엄 팩");
  });

  it("비로그인 상태에서 패키지 클릭 시 결제 모달 대신 로그인으로 이동한다", () => {
    usePackagesMock.mockReturnValue({
      data: mockPackages,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <CoinPackageList />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("프리미엄 팩"));

    expect(navigateMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByTestId("payment-modal")).toBeNull();
  });
});
