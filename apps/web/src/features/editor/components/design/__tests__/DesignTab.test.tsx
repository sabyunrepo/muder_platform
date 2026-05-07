import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock, useModuleSchemasMock } = vi.hoisted(
  () => ({
    mutateMock: vi.fn(),
    useUpdateConfigJsonMock: vi.fn(),
    useModuleSchemasMock: vi.fn(),
  })
);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/editor/api', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  useModuleSchemas: () => useModuleSchemasMock(),
  editorKeys: {
    all: ['editor'],
    theme: (id: string) => ['editor', 'themes', id],
  },
}));

vi.mock('@/features/editor/editorConfigApi', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
}));

vi.mock('@/services/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock('@/features/editor/templateApi', () => ({}));

vi.mock('@/features/editor/components/SchemaDrivenForm', () => ({
  SchemaDrivenForm: () => null,
}));

vi.mock('@/features/editor/constants', () => ({
  MODULE_CATEGORIES: [
    {
      key: 'core',
      label: '코어',
      modules: [
        {
          id: 'connection',
          name: '접속 관리',
          description: '플레이어 접속/재접속 처리',
          required: true,
        },
      ],
    },
    {
      key: 'progression',
      label: '진행',
      modules: [{ id: 'reading', name: '리딩', description: '대사 낭독 시스템', required: false }],
    },
  ],
  REQUIRED_MODULE_IDS: ['connection'],
  OPTIONAL_MODULE_CATEGORIES: [
    {
      key: 'progression',
      label: '진행',
      modules: [{ id: 'reading', name: '리딩', description: '대사 낭독 시스템', required: false }],
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

  it('모듈 설정 단일 화면을 렌더링한다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.getByText('진행')).toBeDefined();
    expect(screen.getByRole('switch', { name: '리딩 활성화' })).toBeDefined();
  });

  it('게임 설계 내부 서브탭을 렌더링하지 않는다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.queryByRole('button', { name: '흐름' })).toBeNull();
    expect(screen.queryByRole('button', { name: '장소' })).toBeNull();
    expect(screen.queryByRole('button', { name: '결말' })).toBeNull();
    expect(screen.queryByText('배치')).toBeNull();
    expect(screen.queryByText('설정')).toBeNull();
  });

  it.each(['modules', 'design/flow', 'design/locations', 'design/endings'] as const)(
    'legacy routeSegment=%s이어도 게임 설계 화면은 모듈 설정만 보여준다',
    (routeSegment) => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} routeSegment={routeSegment} />);

    expect(screen.getByText('진행')).toBeDefined();
    expect(screen.queryByText('FlowSubTab 콘텐츠')).toBeNull();
    expect(screen.queryByText('LocationsSubTab 콘텐츠')).toBeNull();
    expect(screen.queryByText('EndingEntitySubTab 콘텐츠')).toBeNull();
  },
  );

  it('모듈 탭이 기본 선택되어 모듈 사이드바가 표시된다', () => {
    render(<DesignTab themeId="theme-1" theme={mockTheme} />);

    // optional 카테고리(진행)만 표시, 코어(required)는 숨김
    expect(screen.getByText('진행')).toBeDefined();
    expect(screen.queryByText('코어')).toBeNull();
  });
});
