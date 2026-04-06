import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useDashboardMock } = vi.hoisted(() => ({
  useDashboardMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: ../api
// ---------------------------------------------------------------------------

vi.mock("../../api", () => ({
  useDashboard: () => useDashboardMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CreatorDashboard } from "../CreatorDashboard";

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

describe("CreatorDashboard", () => {
  it("3개의 요약 카드를 포매팅된 숫자로 렌더링한다", () => {
    useDashboardMock.mockReturnValue({
      data: {
        total_earnings: 125000,
        unsettled_earnings: 45000,
        total_sales: 1234,
      },
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <CreatorDashboard />
      </MemoryRouter>,
    );

    // 총 수익
    expect(screen.getByText("125,000")).toBeDefined();
    // 미정산
    expect(screen.getByText("45,000")).toBeDefined();
    // 총 판매
    expect(screen.getByText("1,234")).toBeDefined();

    // 라벨
    expect(screen.getByText("총 수익")).toBeDefined();
    expect(screen.getByText("미정산")).toBeDefined();
    expect(screen.getByText("총 판매")).toBeDefined();
  });

  it("로딩 중일 때 스피너를 표시한다", () => {
    useDashboardMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(
      <MemoryRouter>
        <CreatorDashboard />
      </MemoryRouter>,
    );

    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("수익 내역과 정산 내역 링크를 렌더링한다", () => {
    useDashboardMock.mockReturnValue({
      data: {
        total_earnings: 0,
        unsettled_earnings: 0,
        total_sales: 0,
      },
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <CreatorDashboard />
      </MemoryRouter>,
    );

    const earningsLink = screen.getByText(/수익 내역/);
    expect(earningsLink.closest("a")).toHaveProperty(
      "href",
      expect.stringContaining("/creator/earnings"),
    );

    const settlementsLink = screen.getByText(/정산 내역/);
    expect(settlementsLink.closest("a")).toHaveProperty(
      "href",
      expect.stringContaining("/creator/settlements"),
    );
  });
});
