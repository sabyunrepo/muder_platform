import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../ImageUpload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

import { ClueCard } from '../ClueCard';
import type { ClueResponse } from '@/features/editor/api';

function baseClue(overrides: Partial<ClueResponse> = {}): ClueResponse {
  return {
    id: 'c1',
    theme_id: 't1',
    location_id: null,
    name: '단검',
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

describe('ClueCard round badge', () => {
  const noop = vi.fn();

  it('closed range (2~5) 배지를 표시한다', () => {
    render(
      <ClueCard
        clue={baseClue({ reveal_round: 2, hide_round: 5 })}
        themeId="t1"
        onEdit={noop}
        onDelete={noop}
        onImageUploaded={noop}
      />,
    );
    expect(screen.getByLabelText('라운드 범위').textContent).toBe('R2~5');
  });

  it('open upper bound (~R4) 배지', () => {
    render(
      <ClueCard
        clue={baseClue({ reveal_round: null, hide_round: 4 })}
        themeId="t1"
        onEdit={noop}
        onDelete={noop}
        onImageUploaded={noop}
      />,
    );
    expect(screen.getByLabelText('라운드 범위').textContent).toBe('~R4');
  });

  it('round 필드가 없으면 배지를 전혀 렌더하지 않는다 (Lv 텍스트도 없음)', () => {
    render(
      <ClueCard
        clue={baseClue()}
        themeId="t1"
        onEdit={noop}
        onDelete={noop}
        onImageUploaded={noop}
      />,
    );
    expect(screen.queryByLabelText('라운드 범위')).toBeNull();
    expect(screen.queryByText(/Lv\./)).toBeNull();
  });
});
