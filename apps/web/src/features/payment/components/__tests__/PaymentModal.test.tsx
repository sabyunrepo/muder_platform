import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  createPaymentMutateAsync,
  confirmPaymentMutateAsync,
  toastSuccess,
} = vi.hoisted(() => ({
  createPaymentMutateAsync: vi.fn(),
  confirmPaymentMutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock: @/features/payment/api
// ---------------------------------------------------------------------------

vi.mock("@/features/payment/api", () => ({
  useCreatePayment: () => ({ mutateAsync: createPaymentMutateAsync }),
  useConfirmPayment: () => ({ mutateAsync: confirmPaymentMutateAsync }),
}));

// ---------------------------------------------------------------------------
// Mock: crypto.randomUUID
// ---------------------------------------------------------------------------

vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234",
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PaymentModal } from "../PaymentModal";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPkg = {
  id: "pkg-2",
  platform: "WEB" as const,
  name: "프리미엄 팩",
  price_krw: 30000,
  base_coins: 300,
  bonus_coins: 50,
  total_coins: 350,
};

const onCloseMock = vi.fn();

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

describe("PaymentModal", () => {
  it("선택된 패키지 정보를 표시한다", () => {
    render(
      <PaymentModal pkg={mockPkg} isOpen={true} onClose={onCloseMock} />,
    );

    expect(screen.getByText("프리미엄 팩")).toBeDefined();
    expect(screen.getByText("350 코인")).toBeDefined();
    expect(screen.getByText("30,000원")).toBeDefined();
    expect(screen.getByText("결제하기")).toBeDefined();
  });

  it("결제 처리 중 로딩을 표시한다", async () => {
    // createPayment을 pending 상태로 유지
    createPaymentMutateAsync.mockReturnValue(new Promise(() => {}));

    render(
      <PaymentModal pkg={mockPkg} isOpen={true} onClose={onCloseMock} />,
    );

    fireEvent.click(screen.getByText("결제하기"));

    await waitFor(() => {
      expect(screen.getByText("결제 처리 중...")).toBeDefined();
    });
  });

  it("결제 확인 후 성공 메시지를 표시한다", async () => {
    createPaymentMutateAsync.mockResolvedValue({
      id: "pay-1",
      payment_key: "key-1",
    });
    confirmPaymentMutateAsync.mockResolvedValue({ id: "pay-1" });

    render(
      <PaymentModal pkg={mockPkg} isOpen={true} onClose={onCloseMock} />,
    );

    fireEvent.click(screen.getByText("결제하기"));

    await waitFor(() => {
      expect(screen.getByText("결제가 완료되었습니다!")).toBeDefined();
    });

    expect(toastSuccess).toHaveBeenCalledWith("350 코인이 충전되었습니다!");
  });
});
