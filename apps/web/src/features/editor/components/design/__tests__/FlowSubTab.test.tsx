import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../FlowCanvas', () => ({
  FlowCanvas: ({ themeId }: { themeId: string }) => (
    <div data-testid="flow-canvas" data-theme-id={themeId} />
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FlowSubTab } from '../FlowSubTab';

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

describe('FlowSubTab', () => {
  it('FlowCanvas를 렌더링한다', () => {
    render(<FlowSubTab themeId="theme-1" />);
    expect(screen.getByText('장면 흐름')).toBeDefined();
    expect(screen.getByText(/장면은 게임 진행 순서를 화살표로 연결합니다/)).toBeDefined();
    expect(screen.getByTestId('flow-canvas')).toBeDefined();
  });

  it('themeId prop을 FlowCanvas에 전달한다', () => {
    render(<FlowSubTab themeId="my-theme" />);
    const canvas = screen.getByTestId('flow-canvas');
    expect(canvas.getAttribute('data-theme-id')).toBe('my-theme');
  });

  it('PhaseTimeline을 렌더링하지 않는다', () => {
    render(<FlowSubTab themeId="theme-1" />);
    expect(screen.queryByText('페이즈 타임라인')).toBeNull();
  });
});
