import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { refundMutateMock, useRefundThemeMock, usePurchasedThemesMock, toastSuccess } = vi.hoisted(
  () => ({
    refundMutateMock: vi.fn(),
    useRefundThemeMock: vi.fn(),
    usePurchasedThemesMock: vi.fn(),
    toastSuccess: vi.fn(),
  })
);

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock: ../api
// ---------------------------------------------------------------------------

vi.mock('../../api', () => ({
  useRefundTheme: () => useRefundThemeMock(),
  usePurchasedThemes: () => usePurchasedThemesMock(),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/api-error
// ---------------------------------------------------------------------------

vi.mock('@/lib/api-error', () => ({
  isApiHttpError: (err: unknown) => typeof err === 'object' && err !== null && 'code' in err,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { RefundModal } from '../RefundModal';
import { PurchasedThemes } from '../PurchasedThemes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const onCloseMock = vi.fn();

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  useRefundThemeMock.mockReturnValue({
    mutate: refundMutateMock,
    isPending: false,
  });
  usePurchasedThemesMock.mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RefundModal', () => {
  it('테마 정보와 환불 요약 표면에 하드코딩된 slate dark class를 사용하지 않는다', () => {
    const { baseElement } = render(
      <RefundModal
        purchase={{
          id: 'p1',
          theme_id: 't1',
          theme_title: '추리의 밤',
          theme_slug: 'night-mystery',
          coin_price: 200,
          status: 'COMPLETED' as const,
          has_played: false,
          refundable_until: futureDate(5),
          created_at: '2026-04-01T00:00:00Z',
        }}
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    const forbiddenClasses = [
      'bg-slate-800',
      'border-slate-700',
      'text-slate-100',
      'text-slate-400',
    ];

    expect(screen.getByText('테마')).toBeDefined();
    expect(screen.getByText('추리의 밤')).toBeDefined();
    expect(screen.getByText('구매 가격')).toBeDefined();

    for (const forbiddenClass of forbiddenClasses) {
      expect(baseElement.innerHTML).not.toContain(forbiddenClass);
    }
  });

  it('D-day 카운트다운을 표시한다', () => {
    render(
      <RefundModal
        purchase={{
          id: 'p1',
          theme_id: 't1',
          theme_title: '추리의 밤',
          theme_slug: 'night-mystery',
          coin_price: 200,
          status: 'COMPLETED' as const,
          has_played: false,
          refundable_until: futureDate(5),
          created_at: '2026-04-01T00:00:00Z',
        }}
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    // D-5 (±1 due to timing)
    const dDayEl = screen.getByText(/D-[456]/);
    expect(dDayEl).toBeDefined();
  });

  it('환불 기간 만료 시 환불 버튼이 비활성화된다', () => {
    render(
      <RefundModal
        purchase={{
          id: 'p1',
          theme_id: 't1',
          theme_title: '추리의 밤',
          theme_slug: 'night-mystery',
          coin_price: 200,
          status: 'COMPLETED' as const,
          has_played: false,
          refundable_until: pastDate(2),
          created_at: '2026-04-01T00:00:00Z',
        }}
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    expect(screen.getByText('만료됨')).toBeDefined();
    expect(screen.getByText('환불 기간이 만료되었습니다.')).toBeDefined();

    const refundButton = screen.getByText('환불하기');
    expect(refundButton.closest('button')).toHaveProperty('disabled', true);
  });

  it('has_played가 true일 때 환불 버튼이 비활성화된다', () => {
    render(
      <RefundModal
        purchase={{
          id: 'p1',
          theme_id: 't1',
          theme_title: '추리의 밤',
          theme_slug: 'night-mystery',
          coin_price: 200,
          status: 'COMPLETED' as const,
          has_played: true,
          refundable_until: futureDate(5),
          created_at: '2026-04-01T00:00:00Z',
        }}
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    const refundButton = screen.getByText('환불하기');
    expect(refundButton.closest('button')).toHaveProperty('disabled', true);
  });

  it('플레이한 테마에 경고 메시지를 표시한다', () => {
    render(
      <RefundModal
        purchase={{
          id: 'p1',
          theme_id: 't1',
          theme_title: '추리의 밤',
          theme_slug: 'night-mystery',
          coin_price: 200,
          status: 'COMPLETED' as const,
          has_played: true,
          refundable_until: futureDate(5),
          created_at: '2026-04-01T00:00:00Z',
        }}
        isOpen={true}
        onClose={onCloseMock}
      />
    );

    expect(screen.getByText('플레이한 테마는 환불할 수 없습니다.')).toBeDefined();
  });
});

describe('PurchasedThemes', () => {
  it('구매한 테마 제목과 메타 정보를 테마 토큰 색상으로 표시한다', () => {
    usePurchasedThemesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'p1',
            theme_id: 't1',
            theme_title: '추리의 밤',
            theme_slug: 'night-mystery',
            coin_price: 200,
            status: 'COMPLETED' as const,
            has_played: false,
            refundable_until: futureDate(5),
            created_at: '2026-04-01T00:00:00Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
    });

    render(<PurchasedThemes />);

    const title = screen.getByRole('heading', { name: '추리의 밤' });
    const meta = screen.getByText('구매일').parentElement?.parentElement;

    expect(title.className).toContain('text-[var(--mmp-color-ink)]');
    expect(title.className).not.toContain('text-slate-100');
    expect(meta?.className).toContain('text-[var(--mmp-color-steel)]');
    expect(meta?.className).not.toContain('text-slate-400');
  });
});
