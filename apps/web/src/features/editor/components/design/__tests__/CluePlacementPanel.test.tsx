import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock, useEditorCluesMock, useEditorLocationsMock } =
  vi.hoisted(() => ({
    mutateMock: vi.fn(),
    useUpdateConfigJsonMock: vi.fn(),
    useEditorCluesMock: vi.fn(),
    useEditorLocationsMock: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  useEditorClues: () => useEditorCluesMock(),
  useEditorLocations: () => useEditorLocationsMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CluePlacementPanel } from '../CluePlacementPanel';
import type { EditorThemeResponse, ClueResponse, LocationResponse } from '@/features/editor/api';

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

const mockClues: ClueResponse[] = [
  {
    id: 'clue-1',
    theme_id: 'theme-1',
    location_id: null,
    name: '단검',
    description: null,
    image_url: null,
    is_common: false,
    level: 1,
    sort_order: 0,
    created_at: '2026-04-13T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
  },
  {
    id: 'clue-2',
    theme_id: 'theme-1',
    location_id: null,
    name: '편지',
    description: null,
    image_url: null,
    is_common: false,
    level: 1,
    sort_order: 1,
    created_at: '2026-04-13T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
  },
];

const mockLocations: LocationResponse[] = [
  {
    id: 'loc-1',
    theme_id: 'theme-1',
    map_id: 'map-1',
    name: '서재',
    restricted_characters: null,
    sort_order: 0,
    created_at: '2026-04-13T00:00:00Z',
  },
  {
    id: 'loc-2',
    theme_id: 'theme-1',
    map_id: 'map-1',
    name: '부엌',
    restricted_characters: null,
    sort_order: 1,
    created_at: '2026-04-13T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
  useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
  useEditorLocationsMock.mockReturnValue({ data: mockLocations, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CluePlacementPanel', () => {
  it('미배치 단서 목록이 렌더링된다', () => {
    render(<CluePlacementPanel themeId="theme-1" theme={baseTheme} />);

    expect(screen.getByText('단검')).toBeDefined();
    expect(screen.getByText('편지')).toBeDefined();
    expect(screen.getByText('미배치 단서 (2)')).toBeDefined();
  });

  it('단서 배치 시 mutate가 호출된다', () => {
    render(<CluePlacementPanel themeId="theme-1" theme={baseTheme} />);

    const select = screen.getByLabelText('단검 장소 선택');
    fireEvent.change(select, { target: { value: 'loc-1' } });

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect((config.clue_placement as Record<string, string>)['clue-1']).toBe('loc-1');
  });

  it('배치 해제 시 mutate가 호출된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: { clue_placement: { 'clue-1': 'loc-1' } },
    };
    render(<CluePlacementPanel themeId="theme-1" theme={theme} />);

    const unassignBtn = screen.getByLabelText('단검 배치 해제');
    fireEvent.click(unassignBtn);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const placement = config.clue_placement as Record<string, string>;
    expect(placement['clue-1']).toBeUndefined();
  });

  it('단서가 없으면 안내 메시지가 표시된다', () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });

    render(<CluePlacementPanel themeId="theme-1" theme={baseTheme} />);

    expect(screen.getByText('단서를 먼저 추가하세요')).toBeDefined();
  });

  it('장소가 없으면 안내 메시지가 표시된다', () => {
    useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false });

    render(<CluePlacementPanel themeId="theme-1" theme={baseTheme} />);

    expect(screen.getByText('장소를 먼저 추가하세요')).toBeDefined();
  });
});
