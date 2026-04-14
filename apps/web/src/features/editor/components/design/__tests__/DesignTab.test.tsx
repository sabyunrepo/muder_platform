import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock, useModuleSchemasMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
  useModuleSchemasMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  useModuleSchemas: () => useModuleSchemasMock(),
}));

vi.mock('@/features/editor/templateApi', () => ({}));

vi.mock('@/features/editor/components/SchemaDrivenForm', () => ({
  SchemaDrivenForm: () => null,
}));

// Mock subtab components that have external dependencies
vi.mock('../../design/FlowSubTab', () => ({
  FlowSubTab: () => <div>FlowSubTab 콘텐츠</div>,
}));
vi.mock('../../design/LocationsSubTab', () => ({
  LocationsSubTab: () => <div>LocationsSubTab 콘텐츠</div>,
}));

vi.mock('@/features/editor/constants', () => ({
  MODULE_CATEGORIES: [
    {
      key: 'core',
      label: '코어',
      modules: [
        { id: 'connection', name: '접속 관리', description: '플레이어 접속/재접속 처리', required: true },
      ],
    },
    {
      key: 'progression',
      label: '진행',
      modules: [
        { id: 'reading', name: '리딩', description: '대사 낭독 시스템', required: false },
      ],
    },
  ],
  REQUIRED_MODULE_IDS: ['connection'],
  OPTIONAL_MODULE_CATEGORIES: [
    {
      key: 'progression',
      label: '진행',
      modules: [
        { id: 'reading', name: '리딩', description: '대사 낭독 시스템', required: false },
      ],
    },
  ],
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DesignTab } from '../../DesignTab';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTheme = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test-theme',
  description: '테스트 설명',
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  status: 'DRAFT' as const,
  config_json: { modules: ['connection'] },
  version: 1,
  created_at: '2026-04-05T00:00:00Z',
};

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

describe('DesignTab', () => {
  beforeEach(() => {
    useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
    useModuleSchemasMock.mockReturnValue({ data: null, isLoading: false });
  });

  it('서브탭 3개를 모두 렌더링한다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.getByText('모듈')).toBeDefined();
    expect(screen.getByText('흐름')).toBeDefined();
    expect(screen.getByText('장소')).toBeDefined();
  });

  it('배치, 설정 탭이 없다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.queryByText('배치')).toBeNull();
    expect(screen.queryByText('설정')).toBeNull();
  });

  it('기본 선택 탭은 모듈이다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    const modulesTab = screen.getByText('모듈').closest('button');
    expect(modulesTab?.className).toContain('border-amber-500');
  });

  it('흐름 탭 클릭 시 흐름 콘텐츠로 전환된다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('흐름'));
    expect(screen.getByText('FlowSubTab 콘텐츠')).toBeDefined();
  });

  it('장소 탭 클릭 시 장소 콘텐츠로 전환된다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('장소'));
    expect(screen.getByText('LocationsSubTab 콘텐츠')).toBeDefined();
  });

  it('모듈 탭이 기본 선택되어 모듈 사이드바가 표시된다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    // optional 카테고리(진행)만 표시, 코어(required)는 숨김
    expect(screen.getByText('진행')).toBeDefined();
    expect(screen.queryByText('코어')).toBeNull();
  });
});
