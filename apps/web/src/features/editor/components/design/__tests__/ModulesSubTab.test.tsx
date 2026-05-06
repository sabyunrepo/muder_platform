import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';

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
  useModuleSchemas: () => useModuleSchemasMock(),
  editorKeys: {
    all: ['editor'],
    theme: (id: string) => ['editor', 'themes', id],
  },
}));

vi.mock('@/features/editor/editorConfigApi', () => ({
  useUpdateConfigJson: (_id: string, opts?: { onConflictAfterRetry?: () => void }) =>
    useUpdateConfigJsonMock(opts),
}));

vi.mock('@/services/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock('@/features/editor/templateApi', () => ({}));

vi.mock('@/features/editor/components/SchemaDrivenForm', () => ({
  SchemaDrivenForm: ({
    schema,
    onChange,
  }: {
    schema: { title?: string };
    onChange: (path: string, value: unknown) => void;
  }) => (
    <div data-testid="schema-driven-form">
      <span>{schema?.title ?? 'form'}</span>
      <button
        type="button"
        onClick={() => onChange('candidatePolicy.includeDetective', true)}
      >
        탐정 포함 저장
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ModulesSubTab } from '../ModulesSubTab';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  MODULE_CATEGORIES,
  OPTIONAL_MODULE_CATEGORIES,
  REQUIRED_MODULE_IDS,
} from '@/features/editor/constants';

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

let capturedConflictHandler: (() => void) | undefined;

beforeEach(() => {
  capturedConflictHandler = undefined;
  useUpdateConfigJsonMock.mockImplementation((opts?: { onConflictAfterRetry?: () => void }) => {
    capturedConflictHandler = opts?.onConflictAfterRetry;
    return { mutate: mutateMock, isPending: false };
  });
  useModuleSchemasMock.mockReturnValue({ data: null, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModulesSubTab', () => {
  it('코어 모듈(required)이 렌더링되지 않는다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const coreModules = MODULE_CATEGORIES.find((c) => c.key === 'core')!.modules;
    for (const mod of coreModules) {
      expect(screen.queryByText(mod.name)).toBeNull();
    }
  });

  it('optional 카테고리 라벨이 렌더링된다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    for (const category of OPTIONAL_MODULE_CATEGORIES) {
      expect(screen.getByText(category.label)).toBeDefined();
    }
  });

  it('코어 카테고리(코어)는 렌더링되지 않는다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    // "코어" label should not appear since all its modules are required
    expect(screen.queryByText('코어')).toBeNull();
  });

  it('선택 모듈 목록에는 실제 선택 가능한 모듈만 포함된다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const expectedVisibleModuleNames = [
      '텍스트 채팅',
      '귓속말',
      '그룹 채팅',
      '투표',
      '고발',
      '단서 조사',
      '단서 교환',
    ];

    for (const moduleName of expectedVisibleModuleNames) {
      expect(screen.getByText(moduleName)).toBeDefined();
    }
  });

  it('미지원 계획 모듈과 기본 제작 화면 모듈은 렌더링되지 않는다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const expectedHiddenModuleNames = [
      '접속 관리',
      '스크립트 진행',
      '하이브리드 진행',
      '리딩',
      '엔딩',
      '히든 미션',
      '층 탐색',
      '시작 단서',
      '라운드 단서',
      '시간 단서',
    ];

    for (const moduleName of expectedHiddenModuleNames) {
      expect(screen.queryByText(moduleName)).toBeNull();
    }
  });

  it('토글 버튼 클릭 시 mutate가 호출된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const toggleBtn = screen.getByRole('switch', { name: `${optionalMod.name} 활성화` });
    fireEvent.click(toggleBtn);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config.modules).toMatchObject({ [optionalMod.id]: { enabled: true } });
  });

  it('활성화된 모듈 토글 클릭 시 목록에서 제거된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    const themeWithMod: EditorThemeResponse = {
      ...baseTheme,
      config_json: { modules: [optionalMod.id] },
    };

    render(<ModulesSubTab themeId="theme-1" theme={themeWithMod} />);

    const toggleBtn = screen.getByRole('switch', { name: `${optionalMod.name} 비활성화` });
    fireEvent.click(toggleBtn);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config.modules).toMatchObject({ [optionalMod.id]: { enabled: false } });
  });

  it('활성화 + 스키마 있으면 SchemaDrivenForm이 바로 렌더링된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    const themeWithMod: EditorThemeResponse = {
      ...baseTheme,
      config_json: { modules: [optionalMod.id] },
    };
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          [optionalMod.id]: { type: 'object', title: '테스트 설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={themeWithMod} />);

    // No click needed — inline display
    expect(screen.getByTestId('schema-driven-form')).toBeDefined();
    expect(screen.getByText('테스트 설정')).toBeDefined();
  });

  it('비활성 모듈은 스키마가 있어도 SchemaDrivenForm이 렌더링되지 않는다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          [optionalMod.id]: { type: 'object', title: '설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    expect(screen.queryByTestId('schema-driven-form')).toBeNull();
  });

  it('스키마 폼의 dotted path 변경을 nested module config로 저장한다', () => {
    const themeWithVoting: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        modules: {
          voting: {
            enabled: true,
            config: { candidatePolicy: { includeSelf: false }, maxRounds: 3 },
          },
        },
      },
    };
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          voting: { type: 'object', title: '투표 설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={themeWithVoting} />);
    fireEvent.click(screen.getByRole('button', { name: '탐정 포함 저장' }));

    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config.modules).toMatchObject({
      voting: {
        enabled: true,
        config: {
          maxRounds: 3,
          candidatePolicy: { includeSelf: false, includeDetective: true },
        },
      },
    });
  });

  it('mutate payload에 theme.version이 포함된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    const versionedTheme: EditorThemeResponse = { ...baseTheme, version: 42 };

    render(<ModulesSubTab themeId="theme-1" theme={versionedTheme} />);

    fireEvent.click(screen.getByRole('switch', { name: `${optionalMod.name} 활성화` }));

    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config.version).toBe(42);
  });

  it('conflict-after-retry 시 Snackbar 충돌 메시지를 표시한다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);
    fireEvent.click(screen.getByRole('switch', { name: `${optionalMod.name} 활성화` }));

    // Simulate hook's conflict path: first onConflictAfterRetry, then onError
    capturedConflictHandler?.();
    const [, callbacks] = mutateMock.mock.calls[0] as [
      unknown,
      { onError: () => void },
    ];
    callbacks.onError();

    expect(toast.error).toHaveBeenCalledWith(
      '동시 편집 충돌 — 최신 상태 다시 불러오기',
    );
  });

  it('일반 에러는 기본 에러 메시지를 표시한다 (충돌 아님)', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);
    fireEvent.click(screen.getByRole('switch', { name: `${optionalMod.name} 활성화` }));

    // No conflict handler fired — regular failure
    const [, callbacks] = mutateMock.mock.calls[0] as [
      unknown,
      { onError: () => void },
    ];
    callbacks.onError();

    expect(toast.error).toHaveBeenCalledWith('모듈 설정 저장에 실패했습니다');
  });

  it('REQUIRED_MODULE_IDS의 모듈은 toggle 버튼이 없다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const allModules = MODULE_CATEGORIES.flatMap((c) => c.modules);
    for (const id of REQUIRED_MODULE_IDS) {
      const mod = allModules.find((m) => m.id === id)!;
      expect(screen.queryByRole('switch', { name: `${mod.name} 활성화` })).toBeNull();
      expect(screen.queryByRole('switch', { name: `${mod.name} 비활성화` })).toBeNull();
    }
  });
});
