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
  editorKeys: {
    theme: (id: string) => ['editor', 'themes', id] as const,
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { LocationClueAssignPanel } from '../LocationClueAssignPanel';
import type { EditorThemeResponse, ClueResponse, LocationResponse } from '@/features/editor/api';

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

/** Render wrapped in a fresh QueryClient (component uses useQueryClient). */
function renderQC(ui: ReactElement): { qc: QueryClient } {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return { qc };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocationClueAssignPanel', () => {
  it('모든 clue가 chip으로 렌더링된다', () => {
    renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    expect(screen.getByText('단검')).toBeDefined();
    expect(screen.getByText('편지')).toBeDefined();
  });

  it('헤더에 현재 배정 개수/전체 개수가 표시된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: { locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }] },
    };
    renderQC(<LocationClueAssignPanel themeId="theme-1" theme={theme} location={mockLocation} />);
    expect(screen.getByText('(1/2)')).toBeDefined();
  });

  it('배정된 clue는 전체 목록에서 비활성화되고 우측 목록에 표시된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: { locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }] },
    };
    renderQC(<LocationClueAssignPanel themeId="theme-1" theme={theme} location={mockLocation} />);
    expect((screen.getByLabelText('단검 추가') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('편지 추가') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByLabelText('단검 제거')).toBeDefined();
  });

  it('배정되지 않은 clue 클릭 시 clueIds에 추가되어 mutate가 호출된다', () => {
    renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    fireEvent.click(screen.getByLabelText('단검 추가'));
    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const locs = config.locations as Array<{
      id: string;
      locationClueConfig: { clueIds: string[] };
    }>;
    expect(locs).toHaveLength(1);
    expect(locs[0]).toEqual({ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } });
  });

  it('이미 배정된 clue 클릭 시 clueIds에서 제거된다', () => {
    const theme: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1', 'clue-2'] } }],
      },
    };
    renderQC(<LocationClueAssignPanel themeId="theme-1" theme={theme} location={mockLocation} />);
    fireEvent.click(screen.getByLabelText('단검 제거'));
    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const locs = config.locations as Array<{
      id: string;
      locationClueConfig: { clueIds: string[] };
    }>;
    expect(locs[0].locationClueConfig.clueIds).toEqual(['clue-2']);
  });

  it('onChange prop은 mutate 성공 시 호출된다', () => {
    // mutate 는 (config, { onSuccess }) 형태. 테스트에서 onSuccess 를 즉시 호출하도록 stub.
    mutateMock.mockImplementation((_cfg, opts) => opts?.onSuccess?.());
    const onChange = vi.fn();
    renderQC(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText('단검 추가'));
    expect(onChange).toHaveBeenCalledWith(['clue-1']);
  });

  it('clue가 없으면 안내 메시지가 표시된다', () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });
    renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    expect(screen.getByText('단서가 없습니다')).toBeDefined();
  });

  it('allClues prop이 주어지면 hook data 를 덮어쓴다', () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });
    renderQC(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
        allClues={mockClues}
      />
    );
    expect(screen.getByText('단검')).toBeDefined();
  });

  it('isPending 중에는 chip 이 disabled 된다', () => {
    useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: true });
    renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    const chip = screen.getByLabelText('단검 추가') as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: optimistic update + rollback (HIGH-2)
// ---------------------------------------------------------------------------

describe('LocationClueAssignPanel optimistic update + rollback', () => {
  const cacheKey = ['editor', 'themes', 'theme-1'] as const;

  it('commit 시 theme 캐시의 config_json 이 낙관 반영된다', () => {
    const { qc } = renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    qc.setQueryData(cacheKey, baseTheme);

    fireEvent.click(screen.getByLabelText('단검 추가'));

    const cached = qc.getQueryData<EditorThemeResponse>(cacheKey);
    const locs = (
      cached?.config_json as {
        locations?: Array<{ id: string; locationClueConfig: { clueIds: string[] } }>;
      }
    )?.locations;
    expect(locs?.[0]).toEqual({
      id: 'loc-1',
      locationClueConfig: { clueIds: ['clue-1'] },
    });
    expect(mutateMock).toHaveBeenCalledOnce();
  });

  it('mutate onError 시 이전 theme 로 rollback + 실패 토스트', () => {
    mutateMock.mockImplementation((_cfg, opts) => opts?.onError?.(new Error('fail')));

    const { qc } = renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    qc.setQueryData(cacheKey, baseTheme);

    fireEvent.click(screen.getByLabelText('단검 추가'));

    const cached = qc.getQueryData<EditorThemeResponse>(cacheKey);
    expect(cached?.config_json).toEqual({}); // rolled back to baseTheme.config_json
    expect(toastError).toHaveBeenCalledWith('단서 배정 저장에 실패했습니다');
  });

  it('연속 토글에서 첫 mutation 실패 시 첫 토글 직전 상태로 rollback 된다 (M5 closure)', () => {
    // 시나리오:
    //   1) 초기 config_json = {}
    //   2) 첫 토글 (clue-1 추가) — inflight
    //   3) 두 번째 토글 (clue-2 추가) — inflight. 캐시는 clue-1,clue-2 로 optimistic 업데이트됨
    //   4) 첫 요청이 onError 콜백을 호출
    //   → mutation-scoped closure 가 포착한 "빈 config_json" 으로 rollback 되어야 한다.
    //      (잘못 구현하면 두 번째 토글 직전의 {clue-1} 로 돌아가 state 가 유실됨)
    const deferred: Array<(opts: unknown) => void> = [];
    mutateMock.mockImplementation((_cfg, opts) => {
      // onError 를 나중에 호출할 수 있도록 저장만 한다.
      deferred.push(() => opts?.onError?.(new Error('fail')));
    });

    const onChange = vi.fn();
    const { qc } = renderQC(
      <LocationClueAssignPanel
        themeId="theme-1"
        theme={baseTheme}
        location={mockLocation}
        onChange={onChange}
      />
    );
    // 초기 캐시: 배정 없음
    qc.setQueryData(cacheKey, baseTheme);

    // 1st toggle: clue-1 추가 → 캐시 optimistic = {locations:[{loc-1,[clue-1]}]}
    fireEvent.click(screen.getByLabelText('단검 추가'));

    // 2nd toggle: 같은 컴포넌트의 `theme` prop 은 불변이므로 여전히 baseTheme 기준이지만,
    // queryClient 캐시는 1차 optimistic 결과를 반영 중. 두 번째 commit 이 이 시점 캐시를
    // previous 로 캡처하도록 fire.
    fireEvent.click(screen.getByLabelText('편지 추가'));

    expect(deferred).toHaveLength(2);

    // 1st mutation 실패 → 1st closure 의 previous (baseTheme, config_json={}) 로 롤백
    deferred[0]({});

    const cached = qc.getQueryData<EditorThemeResponse>(cacheKey);
    // 핵심 검증: 첫 토글 직전 상태로 롤백 (빈 config_json).
    // 단일 rollbackRef 구현이었다면 두 번째 토글 직전 스냅샷(clue-1 포함)으로 잘못 복원됨.
    expect(cached?.config_json).toEqual({});
    expect(toastError).toHaveBeenCalledWith('단서 배정 저장에 실패했습니다');
  });

  it('theme 캐시가 없으면 mutate 만 호출되고 rollback 대상도 없다', () => {
    mutateMock.mockImplementation((_cfg, opts) => opts?.onError?.(new Error('fail')));
    const { qc } = renderQC(
      <LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={mockLocation} />
    );
    // no setQueryData

    fireEvent.click(screen.getByLabelText('단검 추가'));

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(qc.getQueryData(cacheKey)).toBeUndefined();
    expect(toastError).toHaveBeenCalled();
  });
});
