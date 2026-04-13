import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FlowSubTab } from '../FlowSubTab';
import type { EditorThemeResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const baseTheme: EditorThemeResponse = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test-theme',
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  coin_price: 0,
  status: 'DRAFT',
  config_json: {},
  version: 1,
  created_at: '2026-04-13T00:00:00Z',
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.useFakeTimers();
  useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FlowSubTab', () => {
  it('빈 상태에서 "표준 머더미스터리 프리셋 적용" 버튼이 보인다', () => {
    render(<FlowSubTab themeId="theme-1" theme={baseTheme} />);
    expect(screen.getByText('표준 머더미스터리 프리셋 적용')).toBeDefined();
  });

  it('빈 상태에서 페이즈 수는 0개이다', () => {
    render(<FlowSubTab themeId="theme-1" theme={baseTheme} />);
    expect(screen.getByText('0개')).toBeDefined();
  });

  it('프리셋 적용 시 5개 페이즈가 렌더링되고 저장이 호출된다', async () => {
    render(<FlowSubTab themeId="theme-1" theme={baseTheme} />);

    fireEvent.click(screen.getByText('표준 머더미스터리 프리셋 적용'));

    expect(screen.getByText('5개')).toBeDefined();
    // Labels rendered in select options or inputs
    expect(screen.getAllByDisplayValue('소개').length).toBeGreaterThan(0);

    // Debounce fires after 500ms
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(Array.isArray(config.phases)).toBe(true);
    expect((config.phases as unknown[]).length).toBe(5);
  });

  it('프리셋 적용 후 페이즈 삭제 시 수가 줄어든다', async () => {
    render(<FlowSubTab themeId="theme-1" theme={baseTheme} />);

    fireEvent.click(screen.getByText('표준 머더미스터리 프리셋 적용'));
    expect(screen.getByText('5개')).toBeDefined();

    // Flush the debounce for preset
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    // Click first delete button
    const deleteButtons = screen.getAllByLabelText('페이즈 삭제');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('4개')).toBeDefined();

    // Flush the debounce for delete
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it('기존 config_json.phases가 있으면 로드된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        phases: [
          { type: 'intro', label: '소개', duration: 10, rounds: 1 },
          { type: 'voting', label: '투표', duration: 5, rounds: 1 },
        ],
      },
    };
    render(<FlowSubTab themeId="theme-1" theme={theme} />);
    expect(screen.getByText('2개')).toBeDefined();
  });

  it('시간 입력 변경 시 저장이 호출된다', async () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        phases: [{ type: 'intro', label: '소개', duration: 10, rounds: 1 }],
      },
    };
    render(<FlowSubTab themeId="theme-1" theme={theme} />);

    const durationInputs = screen.getAllByDisplayValue('10');
    fireEvent.change(durationInputs[0], { target: { value: '15' } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const phases = config.phases as Array<{ duration: number }>;
    expect(phases[0].duration).toBe(15);
  });
});
