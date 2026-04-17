import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { ClueListRow } from '../ClueListRow';
import type { ClueResponse } from '@/features/editor/api';

function baseClue(overrides: Partial<ClueResponse> = {}): ClueResponse {
  return {
    id: 'c1',
    theme_id: 't1',
    location_id: null,
    name: '독병',
    description: null,
    image_url: null,
    is_common: false,
    level: 1,
    sort_order: 0,
    created_at: '2026-04-17T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
    ...overrides,
  };
}

afterEach(cleanup);

describe('ClueListRow round badge', () => {
  const noop = vi.fn();

  it('single-round (R3) 배지를 표시한다', () => {
    render(
      <ClueListRow
        clue={baseClue({ reveal_round: 3, hide_round: 3 })}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByLabelText('라운드 범위').textContent).toBe('R3');
  });

  it('open lower bound (R2~) 배지', () => {
    render(
      <ClueListRow
        clue={baseClue({ reveal_round: 2, hide_round: null })}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByLabelText('라운드 범위').textContent).toBe('R2~');
  });

  it('round 없으면 Lv 텍스트와 배지 모두 생략된다', () => {
    render(
      <ClueListRow
        clue={baseClue()}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByLabelText('라운드 범위')).toBeNull();
    expect(screen.queryByText(/Lv\./)).toBeNull();
  });

  it('공통 배지와 라운드 배지가 함께 렌더된다', () => {
    render(
      <ClueListRow
        clue={baseClue({ reveal_round: 1, hide_round: 4, is_common: true })}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByLabelText('라운드 범위').textContent).toBe('R1~4');
    expect(screen.getByText('공통')).toBeDefined();
  });
});
