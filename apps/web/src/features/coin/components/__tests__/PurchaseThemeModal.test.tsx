import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useBalanceMock,
  purchaseMutateMock,
  usePurchaseThemeMock,
  navigateMock,
  toastSuccess,
} = vi.hoisted(() => ({
  useBalanceMock: vi.fn(),
  purchaseMutateMock: vi.fn(),
  usePurchaseThemeMock: vi.fn(),
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
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
// Mock: ../api
// ---------------------------------------------------------------------------

vi.mock("../../api", () => ({
  useBalance: () => useBalanceMock(),
  usePurchaseTheme: () => usePurchaseThemeMock(),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/api-error
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-error", () => ({
  isApiHttpError: (err: unknown) =>
    typeof err === "object" && err !== null && "code" in err,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PurchaseThemeModal } from "../PurchaseThemeModal";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

const onCloseMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PurchaseThemeModal", () => {
  beforeEach(() => {
    usePurchaseThemeMock.mockReturnValue({
      mutate: purchaseMutateMock,
      isPending: false,
    });
  });

  it("잔액과 보너스 우선 차감 프리뷰를 보여준다", () => {
    useBalanceMock.mockReturnValue({
      data: { base_coins: 800, bonus_coins: 200, total_coins: 1000 },
    });

    render(
      <PurchaseThemeModal
        themeId="t1"
        themeTitle="살인의 추억"
        coinPrice={300}
        isOpen={true}
        onClose={onCloseMock}
      />,
    );

    // 테마명
    expect(screen.getByText("살인의 추억")).toBeDefined();
    // 가격
    expect(screen.getByText("300 코인")).toBeDefined();
    // 보유 코인
    expect(screen.getByText("1,000 코인")).toBeDefined();
    // 보너스 우선 차감: bonus_used = min(200, 300) = 200, base_used = 100
    expect(screen.getByText("200")).toBeDefined(); // 보너스 코인 사용
    expect(screen.getByText("100")).toBeDefined(); // 기본 코인 사용
  });

  it("잔액 부족 시 경고와 충전 링크를 표시한다", () => {
    useBalanceMock.mockReturnValue({
      data: { base_coins: 50, bonus_coins: 10, total_coins: 60 },
    });

    render(
      <PurchaseThemeModal
        themeId="t1"
        themeTitle="살인의 추억"
        coinPrice={300}
        isOpen={true}
        onClose={onCloseMock}
      />,
    );

    expect(
      screen.getByText("코인이 부족합니다. 충전 후 다시 시도해주세요."),
    ).toBeDefined();

    // "코인 부족 — 충전하기" 버튼 존재
    const chargeButton = screen.getByText(/충전하기/);
    expect(chargeButton).toBeDefined();
  });

  it("잔액 부족 시 구매 버튼이 비활성화(없음)된다", () => {
    useBalanceMock.mockReturnValue({
      data: { base_coins: 10, bonus_coins: 0, total_coins: 10 },
    });

    render(
      <PurchaseThemeModal
        themeId="t1"
        themeTitle="살인의 추억"
        coinPrice={300}
        isOpen={true}
        onClose={onCloseMock}
      />,
    );

    // 구매하기 버튼이 없고, 대신 충전하기 버튼만 있어야 한다
    expect(screen.queryByText("구매하기")).toBeNull();
    expect(screen.getByText(/충전하기/)).toBeDefined();
  });

  it("PURCHASE_SELF_THEME 에러 메시지를 표시한다", async () => {
    useBalanceMock.mockReturnValue({
      data: { base_coins: 1000, bonus_coins: 0, total_coins: 1000 },
    });

    purchaseMutateMock.mockImplementation(
      (_themeId: string, options: { onError: (err: unknown) => void }) => {
        options.onError({ code: "PURCHASE_SELF_THEME" });
      },
    );

    render(
      <PurchaseThemeModal
        themeId="t1"
        themeTitle="내 테마"
        coinPrice={100}
        isOpen={true}
        onClose={onCloseMock}
      />,
    );

    fireEvent.click(screen.getByText("구매하기"));

    await waitFor(() => {
      expect(
        screen.getByText("자신이 만든 테마는 구매할 수 없습니다."),
      ).toBeDefined();
    });
  });
});
