import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock, useEditorCluesMock, toastSuccess, toastError } =
  vi.hoisted(() => ({
    mutateMock: vi.fn(),
    useUpdateConfigJsonMock: vi.fn(),
    useEditorCluesMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('@/features/editor/api', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  useEditorClues: () => useEditorCluesMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { LocationClueAssignPanel } from '../LocationClueAssignPanel';
import type {
  EditorThemeResponse,
  ClueResponse,
  LocationResponse,
} from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const baseTheme: EditorThemeResponse = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test',
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
  created_at: '2026-04-15T00:00:00Z',
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

const mockLocation: LocationResponse = {
  id: 'loc-1',
  theme_id: 'theme-1',
  map_id: 'map-1',
  name: '서재',
  restricted_characters: null,
  sort_order: 0,
  created_at: '2026-04-15T00:00:00Z',
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
    clue_type: 'physical',
    sort_order: 0,
    created_at: '2026-04-15T00:00:00Z',
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
    clue_type: 'document',
    sort_order: 1,
    created_at: '2026-04-15T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
  },
];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
  useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocationClueAssignPanel', () => {
  it('모든 clue가 chip으로 렌더링된다', () => {
    render(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
      />,
    );
    expect(screen.getByText('단검')).toBeDefined();
    expect(screen.getByText('편지')).toBeDefined();
  });

  it('헤더에 현재 배정 개수/전체 개수가 표시된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: { locations: [{ id: 'loc-1', clueIds: ['clue-1'] }] },
    };
    render(
      <LocationClueAssignPanel themeId="theme-1" theme={theme} location={mockLocation} />,
    );
    expect(screen.getByText('(1/2)')).toBeDefined();
  });

  it('배정된 clue는 aria-checked=true 로 표시된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: { locations: [{ id: 'loc-1', clueIds: ['clue-1'] }] },
    };
    render(
      <LocationClueAssignPanel themeId="theme-1" theme={theme} location={mockLocation} />,
    );
    const chip1 = screen.getByLabelText('단검 배정 토글');
    const chip2 = screen.getByLabelText('편지 배정 토글');
    expect(chip1.getAttribute('aria-checked')).toBe('true');
    expect(chip2.getAttribute('aria-checked')).toBe('false');
  });

  it('배정되지 않은 clue 클릭 시 clueIds에 추가되어 mutate가 호출된다', () => {
    render(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
      />,
    );
    fireEvent.click(screen.getByLabelText('단검 배정 토글'));
    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const locs = config.locations as Array<{ id: string; clueIds: string[] }>;
    expect(locs).toHaveLength(1);
    expect(locs[0]).toEqual({ id: 'loc-1', clueIds: ['clue-1'] });
  });

  it('이미 배정된 clue 클릭 시 clueIds에서 제거된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: { locations: [{ id: 'loc-1', clueIds: ['clue-1', 'clue-2'] }] },
    };
    render(
      <LocationClueAssignPanel themeId="theme-1" theme={theme} location={mockLocation} />,
    );
    fireEvent.click(screen.getByLabelText('단검 배정 토글'));
    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const locs = config.locations as Array<{ id: string; clueIds: string[] }>;
    expect(locs[0].clueIds).toEqual(['clue-2']);
  });

  it('onChange prop은 mutate 성공 시 호출된다', () => {
    // mutate 는 (config, { onSuccess }) 형태. 테스트에서 onSuccess 를 즉시 호출하도록 stub.
    mutateMock.mockImplementation((_cfg, opts) => opts?.onSuccess?.());
    const onChange = vi.fn();
    render(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('단검 배정 토글'));
    expect(onChange).toHaveBeenCalledWith(['clue-1']);
  });

  it('clue가 없으면 안내 메시지가 표시된다', () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });
    render(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
      />,
    );
    expect(screen.getByText('단서가 없습니다')).toBeDefined();
  });

  it('allClues prop이 주어지면 hook data 를 덮어쓴다', () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });
    render(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
        allClues={mockClues}
      />,
    );
    expect(screen.getByText('단검')).toBeDefined();
  });

  it('isPending 중에는 chip 이 disabled 된다', () => {
    useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: true });
    render(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
      />,
    );
    const chip = screen.getByLabelText('단검 배정 토글') as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
  });
});
