import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useSettlementsMock } = vi.hoisted(() => ({
  useSettlementsMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: ../api
// ---------------------------------------------------------------------------

vi.mock("../../api", () => ({
  useSettlements: () => useSettlementsMock(),
}));

// ---------------------------------------------------------------------------
// Mock: ../constants
// ---------------------------------------------------------------------------

vi.mock("../../constants", () => ({
  CREATOR_PAGE_SIZE: 20,
  SETTLEMENT_STATUS_LABEL: {
    CALCULATED: "정산 대기",
    APPROVED: "승인됨",
    PAID_OUT: "지급 완료",
    CANCELLED: "취소됨",
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SettlementList } from "../SettlementList";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSettlements = [
  {
    id: "s1",
    period_start: "2026-03-01T00:00:00Z",
    period_end: "2026-03-31T23:59:59Z",
    total_coins: 50000,
    total_krw: 500000,
    tax_type: "INDIVIDUAL" as const,
    tax_rate: 0.033,
    tax_amount: 16500,
    net_amount: 483500,
    status: "CALCULATED" as const,
    approved_at: null,
    paid_out_at: null,
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "s2",
    period_start: "2026-02-01T00:00:00Z",
    period_end: "2026-02-28T23:59:59Z",
    total_coins: 30000,
    total_krw: 300000,
    tax_type: "INDIVIDUAL" as const,
    tax_rate: 0.033,
    tax_amount: 9900,
    net_amount: 290100,
    status: "APPROVED" as const,
    approved_at: "2026-03-10T00:00:00Z",
    paid_out_at: null,
    created_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "s3",
    period_start: "2026-01-01T00:00:00Z",
    period_end: "2026-01-31T23:59:59Z",
    total_coins: 20000,
    total_krw: 200000,
    tax_type: "INDIVIDUAL" as const,
    tax_rate: 0.033,
    tax_amount: 6600,
    net_amount: 193400,
    status: "PAID_OUT" as const,
    approved_at: "2026-02-10T00:00:00Z",
    paid_out_at: "2026-02-15T00:00:00Z",
    created_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "s4",
    period_start: "2025-12-01T00:00:00Z",
    period_end: "2025-12-31T23:59:59Z",
    total_coins: 10000,
    total_krw: 100000,
    tax_type: "INDIVIDUAL" as const,
    tax_rate: 0.033,
    tax_amount: 3300,
    net_amount: 96700,
    status: "CANCELLED" as const,
    approved_at: null,
    paid_out_at: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

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

describe("SettlementList", () => {
  it("정산 행을 KRW 포매팅으로 렌더링한다", () => {
    useSettlementsMock.mockReturnValue({
      data: { data: mockSettlements, total: 4 },
      isLoading: false,
      isError: false,
    });

    render(<SettlementList />);

    // ₩ formatKRW: ₩500,000, ₩483,500 등
    expect(screen.getByText("₩500,000")).toBeDefined();
    expect(screen.getByText("₩483,500")).toBeDefined();
    expect(screen.getByText("₩300,000")).toBeDefined();
    expect(screen.getByText("₩290,100")).toBeDefined();
    expect(screen.getByText("₩200,000")).toBeDefined();
    expect(screen.getByText("₩193,400")).toBeDefined();
  });

  it("올바른 상태 배지를 표시한다 (CALCULATED=warning, APPROVED=info, PAID_OUT=success, CANCELLED=danger)", () => {
    useSettlementsMock.mockReturnValue({
      data: { data: mockSettlements, total: 4 },
      isLoading: false,
      isError: false,
    });

    render(<SettlementList />);

    expect(screen.getByText("정산 대기")).toBeDefined();
    expect(screen.getByText("승인됨")).toBeDefined();
    expect(screen.getByText("지급 완료")).toBeDefined();
    expect(screen.getByText("취소됨")).toBeDefined();
  });

  it("정산이 없을 때 빈 상태를 표시한다", () => {
    useSettlementsMock.mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
    });

    render(<SettlementList />);

    expect(screen.getByText("정산 내역이 없습니다")).toBeDefined();
  });
});
