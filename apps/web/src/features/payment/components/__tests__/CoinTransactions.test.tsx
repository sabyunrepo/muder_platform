import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useTransactionsMock } = vi.hoisted(() => ({
  useTransactionsMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: @/features/coin/api
// ---------------------------------------------------------------------------

vi.mock("@/features/coin/api", () => ({
  useTransactions: () => useTransactionsMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CoinTransactions } from "../CoinTransactions";

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

describe("CoinTransactions", () => {
  it("renders empty state when data.data is undefined (regression: crash fix)", () => {
    // Regression: data?.data.length crashed when data.data was undefined
    useTransactionsMock.mockReturnValue({
      data: { data: undefined, total: 0 },
      isLoading: false,
    });

    render(<CoinTransactions />);

    expect(screen.getByText("거래 내역이 없습니다")).toBeDefined();
  });

  it("renders empty state when data.data is an empty array", () => {
    useTransactionsMock.mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    });

    render(<CoinTransactions />);

    expect(screen.getByText("거래 내역이 없습니다")).toBeDefined();
  });

  it("renders loading spinner when isLoading is true", () => {
    useTransactionsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<CoinTransactions />);

    // Spinner renders — no crash, no empty-state text
    expect(screen.queryByText("거래 내역이 없습니다")).toBeNull();
    expect(container.firstChild).toBeDefined();
  });

  it("renders transaction rows when data has items", () => {
    useTransactionsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            type: "CHARGE",
            base_amount: 1000,
            bonus_amount: 100,
            balance_after_base: 1000,
            balance_after_bonus: 100,
            reference_type: null,
            reference_id: null,
            description: null,
            created_at: "2026-04-12T10:00:00Z",
          },
        ],
        total: 1,
      },
      isLoading: false,
    });

    render(<CoinTransactions />);

    // Amount: 1000 + 100 = 1100, displayed as "+1,100"
    expect(screen.getByText("+1,100")).toBeDefined();
    // Balance after: 1000 + 100 = 1100
    expect(screen.getByText("1,100")).toBeDefined();
  });
});
