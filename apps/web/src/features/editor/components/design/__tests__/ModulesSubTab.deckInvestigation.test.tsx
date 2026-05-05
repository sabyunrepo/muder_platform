import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const { mutateMock, useUpdateConfigJsonMock, useModuleSchemasMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
  useModuleSchemasMock: vi.fn(),
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
  SchemaDrivenForm: () => <div data-testid="schema-driven-form" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ModulesSubTab } from '../ModulesSubTab';
import type { EditorThemeResponse } from '@/features/editor/api';
import { DECK_INVESTIGATION_MODULE_ID } from '@/features/editor/entities/deckInvestigation/deckInvestigationAdapter';

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

beforeEach(() => {
  useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
  useModuleSchemasMock.mockReturnValue({ data: null, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('ModulesSubTab deck investigation settings', () => {
  it('단서 조사 모듈이 활성화되면 조사권 설정 패널을 렌더링한다', () => {
    const themeWithDeckInvestigation: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        modules: {
          [DECK_INVESTIGATION_MODULE_ID]: {
            enabled: true,
            config: {
              tokens: [
                {
                  id: 'basic-token',
                  name: '기본 조사권',
                  iconLabel: '권',
                  defaultAmount: 1,
                },
              ],
              decks: [],
            },
          },
        },
      },
    };

    render(<ModulesSubTab themeId="theme-1" theme={themeWithDeckInvestigation} />);

    expect(screen.getByText('조사권 설정')).toBeDefined();
    expect(screen.getByRole('textbox', { name: '기본 조사권 조사권 이름' })).toBeDefined();
    expect(screen.getByRole('spinbutton', { name: '기본 조사권 초기 배포량' })).toBeDefined();
  });

  it('조사권 시작 수량 변경을 deck_investigation module config로 저장한다', () => {
    const themeWithDeckInvestigation: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        modules: {
          [DECK_INVESTIGATION_MODULE_ID]: {
            enabled: true,
            config: {
              tokens: [
                {
                  id: 'basic-token',
                  name: '기본 조사권',
                  iconLabel: '권',
                  defaultAmount: 1,
                },
              ],
              decks: [
                {
                  id: 'deck-1',
                  title: '주방 조사',
                  description: '',
                  tokenId: 'basic-token',
                  tokenCost: 1,
                  drawOrder: 'sequential',
                  emptyMessage: '더 이상 얻을 단서가 없습니다.',
                  access: {
                    phaseIds: [],
                    locationIds: ['loc-1'],
                    blockedCharacterIds: [],
                    requiredClueIds: [],
                  },
                  cards: [],
                },
              ],
            },
          },
        },
      },
    };

    render(<ModulesSubTab themeId="theme-1" theme={themeWithDeckInvestigation} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: '기본 조사권 초기 배포량' }), {
      target: { value: '3' },
    });

    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config.modules).toMatchObject({
      [DECK_INVESTIGATION_MODULE_ID]: {
        enabled: true,
        config: {
          tokens: [
            {
              id: 'basic-token',
              name: '기본 조사권',
              iconLabel: '권',
              defaultAmount: 3,
            },
          ],
          decks: [{ id: 'deck-1', tokenId: 'basic-token' }],
        },
      },
    });
    expect(config.version).toBe(1);
  });

  it('사용 중인 조사권 삭제 시 단서 조사 덱을 남은 조사권으로 이동한다', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const themeWithDeckInvestigation: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        modules: {
          [DECK_INVESTIGATION_MODULE_ID]: {
            enabled: true,
            config: {
              tokens: [
                {
                  id: 'basic-token',
                  name: '기본 조사권',
                  iconLabel: '권',
                  defaultAmount: 1,
                },
                {
                  id: 'bonus-token',
                  name: '추가 조사권',
                  iconLabel: '추',
                  defaultAmount: 0,
                },
              ],
              decks: [
                {
                  id: 'deck-1',
                  title: '주방 조사',
                  description: '',
                  tokenId: 'bonus-token',
                  tokenCost: 1,
                  drawOrder: 'sequential',
                  emptyMessage: '더 이상 얻을 단서가 없습니다.',
                  access: {
                    phaseIds: [],
                    locationIds: ['loc-1'],
                    blockedCharacterIds: [],
                    requiredClueIds: [],
                  },
                  cards: [],
                },
              ],
            },
          },
        },
      },
    };

    render(<ModulesSubTab themeId="theme-1" theme={themeWithDeckInvestigation} />);

    fireEvent.click(screen.getByRole('button', { name: '추가 조사권 조사권 삭제' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '조사권 "추가 조사권"을(를) 삭제할까요?\n' +
        '연결된 단서 조사 덱 1개는 다른 조사권으로 자동 변경됩니다.',
    );
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config.modules).toMatchObject({
      [DECK_INVESTIGATION_MODULE_ID]: {
        config: {
          tokens: [{ id: 'basic-token' }],
          decks: [{ id: 'deck-1', tokenId: 'basic-token' }],
        },
      },
    });
  });

  it('조사권 삭제 확인을 취소하면 저장하지 않는다', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const themeWithDeckInvestigation: EditorThemeResponse = {
      ...baseTheme,
      config_json: {
        modules: {
          [DECK_INVESTIGATION_MODULE_ID]: {
            enabled: true,
            config: {
              tokens: [
                {
                  id: 'basic-token',
                  name: '기본 조사권',
                  iconLabel: '권',
                  defaultAmount: 1,
                },
                {
                  id: 'bonus-token',
                  name: '추가 조사권',
                  iconLabel: '추',
                  defaultAmount: 0,
                },
              ],
              decks: [],
            },
          },
        },
      },
    };

    render(<ModulesSubTab themeId="theme-1" theme={themeWithDeckInvestigation} />);

    fireEvent.click(screen.getByRole('button', { name: '추가 조사권 조사권 삭제' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '조사권 "추가 조사권"을(를) 삭제할까요?\n' +
        '연결된 단서 조사 덱 0개는 다른 조사권으로 자동 변경됩니다.',
    );
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
