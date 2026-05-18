import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import type { ClueResponse, EditorCharacterResponse, LocationResponse } from '@/features/editor/api';
import { readClueItemEffect } from '@/features/editor/utils/configShape';
import { ClueEntityWorkspace } from './ClueEntityWorkspace';

const { toastLoadingMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastLoadingMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: toastLoadingMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/features/editor/flowApi', () => ({
  useFlowGraph: () => ({
    data: {
      nodes: [
        { id: 'scene-1', type: 'phase', data: { label: '조사 장면', phase_type: 'investigation' } },
        { id: 'scene-2', type: 'phase', data: { label: '토론 장면', phase_type: 'discussion' } },
        { id: 'ending-1', type: 'ending', data: { label: '진엔딩' } },
      ],
    },
  }),
}));

vi.mock('@/features/editor/readingApi', () => ({
  useReadingSections: () => ({
    data: [],
  }),
}));

vi.mock('@/features/editor/components/media/ImageMediaReferenceField', () => ({
  ImageMediaReferenceField: ({ label }: { label: string }) => (
    <div data-testid="image-media-field">{label}</div>
  ),
}));

function clue(overrides: Partial<ClueResponse>): ClueResponse {
  return {
    id: 'clue-1',
    theme_id: 'theme-1',
    location_id: null,
    name: '피 묻은 열쇠',
    description: '잠긴 상자를 열 수 있다.',
    image_url: null,
    is_common: false,
    level: 1,
    sort_order: 0,
    created_at: '2026-05-03T00:00:00Z',
    is_usable: true,
    use_effect: 'steal',
    use_target: 'player',
    use_consumed: true,
    ...overrides,
  };
}

const locations: LocationResponse[] = [
  {
    id: 'loc-1',
    theme_id: 'theme-1',
    map_id: 'map-1',
    name: '서재',
    restricted_characters: null,
    image_url: null,
    sort_order: 0,
    created_at: '2026-05-03T00:00:00Z',
  },
];

const characters: EditorCharacterResponse[] = [
  {
    id: 'char-1',
    theme_id: 'theme-1',
    name: '탐정',
    description: null,
    secret: null,
    character_type: 'player',
    role: null,
    introduction: null,
    goal: null,
    profile_image_url: null,
    is_killer: false,
    is_accomplice: false,
    is_detective: true,
    detective_vote_policy: 'exclude',
    sort_order: 0,
    created_at: '2026-05-03T00:00:00Z',
  } as EditorCharacterResponse,
];

beforeEach(() => {
  vi.useRealTimers();
  toastLoadingMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ClueEntityWorkspace', () => {
  const flowNodes = [
    { id: 'scene-1', type: 'phase', data: { label: '조사 장면', phase_type: 'investigation' } },
    { id: 'scene-2', type: 'phase', data: { label: '정리 장면', phase_type: 'discussion' } },
    { id: 'scene-3', type: 'phase', data: { label: '재수사 장면', phase_type: 'investigation' } },
    { id: 'branch-1', type: 'branch', data: { label: '이전 분기' } },
    { id: 'ending-1', type: 'ending', data: { label: '진엔딩' } },
  ] as never;

  it('선택한 단서의 인라인 편집 상세와 사용 공개 규칙을 제작자 언어로 보여준다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' }), clue({ id: 'clue-2', name: '비밀 편지', is_usable: false })]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: {
            starting_clue: { enabled: true, config: { startingClues: { 'char-1': ['clue-1'] } } },
            clue_interaction: {
              enabled: true,
              config: {
                itemEffects: {
                  'clue-1': { effect: 'steal', target: 'player', consume: true },
                },
              },
            },
          },
        }}
        locations={locations}
        characters={characters}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('단서 기본 정보')).toBeDefined();
    expect(screen.getByText('단서 사용 설정')).toBeDefined();
    expect(screen.getByLabelText('전체 공개')).toBeDefined();
    expect(screen.getByLabelText(/공개 가능/)).toBeDefined();
    expect(screen.getByLabelText(/단서 보호/)).toBeDefined();
    expect(screen.getAllByText('사용하면 내 단서함에서 사라짐').length).toBeGreaterThan(0);
    expect(screen.getByText('서재의 발견 단서')).toBeDefined();
    expect(screen.getByText('탐정의 시작 단서')).toBeDefined();
    expect(screen.queryByText('단서 트리거')).toBeNull();
    expect(screen.queryByText('투표 시작')).toBeNull();
  });

  it('목록에서 다른 단서를 클릭하면 상세가 교체된다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' }), clue({ id: 'clue-2', name: '비밀 편지', description: '숨겨진 메시지', is_usable: false })]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '비밀 편지 선택' }));

    expect(screen.getAllByText('숨겨진 메시지').length).toBeGreaterThan(0);
    expect((screen.getByLabelText('사용 가능한 아이템') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('button', { name: '설명 변경' })).toBeNull();
  });

  it('단서 상세 수동 저장 버튼을 제거하고 카드별 저장 버튼도 만들지 않는다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '단서 저장' })).toBeNull();
    expect(screen.queryByRole('button', { name: '기본 정보 저장' })).toBeNull();
    expect(screen.queryByRole('button', { name: '사용 설정 저장' })).toBeNull();
  });

  it('단서 목록에는 설명 대신 장소, 사용 설정, 살해 수치, 조사권 배지를 보여준다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[
          clue({
            id: 'clue-1',
            name: '301호',
            description: null,
            is_common: false,
            is_usable: true,
            use_effect: 'kill',
            use_target: 'player',
          }),
        ]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: {
            clue_interaction: {
              enabled: true,
              config: {
                itemEffects: {
                  'clue-1': {
                    effect: 'kill',
                    target: 'player',
                    consume: true,
                    attackPower: 2,
                    defensePower: 2,
                  },
                },
              },
            },
            deck_investigation: {
              enabled: true,
              config: {
                tokens: [{ id: 'basic-token', name: '기본 조사권', iconLabel: '권', defaultAmount: 1 }],
                decks: [
                  {
                    id: 'location-clue-loc-1-clue-1',
                    title: '서재 - 301호 조사',
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
                    cards: [{ clueId: 'clue-1', delivery: 'private_ownership' }],
                  },
                ],
              },
            },
          },
        }}
        flowNodes={flowNodes}
        locations={locations}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const item = screen.getByRole('button', { name: '301호 선택' });
    expect(within(item).queryByText('설명 없음')).toBeNull();
    expect(within(item).getByText('장소: 서재')).toBeDefined();
    expect(within(item).getByText('사용 가능')).toBeDefined();
    expect(within(item).getByText('살해 요청')).toBeDefined();
    expect(within(item).getByText('공격력 2')).toBeDefined();
    expect(within(item).getByText('방어력 2')).toBeDefined();
    expect(within(item).getByText('조사권 1개')).toBeDefined();
    expect(within(item).queryByText(/연결/)).toBeNull();
  });

  it('공개 단서 목록에는 전체 공개와 조사권 무료 배지를 보여준다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1', name: '책장', is_common: true, is_usable: false })]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: {
            deck_investigation: {
              enabled: true,
              config: {
                tokens: [{ id: 'basic-token', name: '기본 조사권', iconLabel: '권', defaultAmount: 1 }],
                decks: [
                  {
                    id: 'location-clue-loc-1-clue-1',
                    title: '서재 - 책장 조사',
                    description: '',
                    tokenId: '',
                    tokenCost: 0,
                    drawOrder: 'sequential',
                    emptyMessage: '더 이상 얻을 단서가 없습니다.',
                    access: {
                      phaseIds: [],
                      locationIds: ['loc-1'],
                      blockedCharacterIds: [],
                      requiredClueIds: [],
                    },
                    cards: [{ clueId: 'clue-1', delivery: 'private_ownership' }],
                  },
                ],
              },
            },
          },
        }}
        flowNodes={flowNodes}
        locations={locations}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const item = screen.getByRole('button', { name: '책장 선택' });
    expect(within(item).getByText('장소: 서재')).toBeDefined();
    expect(within(item).getByText('전체 공개')).toBeDefined();
    expect(within(item).getByText('조사권 무료')).toBeDefined();
    expect(within(item).queryByText(/연결/)).toBeNull();
  });

  it('단서 설명은 목록에 표시하지 않지만 검색에는 사용한다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[
          clue({ id: 'clue-1', name: '책장', description: '숨겨진 서류 봉투' }),
          clue({ id: 'clue-2', name: '우산걸이', description: '젖은 우비' }),
        ]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const list = screen.getByRole('region', { name: '단서 목록' });
    expect(within(list).queryByText('숨겨진 서류 봉투')).toBeNull();

    fireEvent.change(screen.getByLabelText('단서 검색'), { target: { value: '숨겨진 서류' } });

    expect(within(list).getByText('책장')).toBeDefined();
    expect(within(list).queryByText('우산걸이')).toBeNull();
    expect(within(list).queryByText('숨겨진 서류 봉투')).toBeNull();
  });

  it('기본 정보 변경 후 1.5초가 지나면 선택 단서 update payload와 보호 정책을 자동저장한다', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const onConfigChange = vi.fn();

    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onConfigChange={onConfigChange}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getAllByText('계속 획득 가능').length).toBeGreaterThan(0);
    expect(screen.getAllByText('조사 장면 (장면)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('재수사 장면 (장면)').length).toBeGreaterThan(0);
    expect(screen.queryByText('정리 장면 (장면)')).toBeNull();
    expect(screen.queryByText('진엔딩 (결말)')).toBeNull();
    expect(screen.getByText(/이미 플레이어가 가진 단서를/)).toBeDefined();

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '피 묻은 열쇠 조각' },
    });
    fireEvent.change(screen.getByLabelText('공개 시점'), {
      target: { value: 'scene-1' },
    });
    fireEvent.change(screen.getByLabelText('획득 가능 종료'), {
      target: { value: 'scene-3' },
    });
    fireEvent.click(screen.getByLabelText(/단서 보호/));

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(onUpdate).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(
      'clue-1',
      expect.objectContaining({
        name: '피 묻은 열쇠 조각',
        is_usable: true,
        use_effect: 'steal',
        use_target: 'player',
        use_consumed: true,
        reveal_round: null,
        hide_round: null,
        reveal_scene_id: 'scene-1',
        hide_scene_id: 'scene-3',
      }),
      expect.any(Object),
    );
    expect(onConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          clue_interaction: expect.objectContaining({
            config: expect.objectContaining({
              cluePolicies: expect.objectContaining({
                'clue-1': expect.objectContaining({ revealable: true, protected: true }),
              }),
            }),
          }),
        }),
      }),
      expect.any(Object),
    );
    expect(toastLoadingMock).toHaveBeenCalledWith('단서 자동저장 중...', expect.objectContaining({ id: 'clue-detail-autosave' }));
  });

  it('기본 정보와 사용 설정 변경을 하나의 자동저장 주기로 저장한다', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const onConfigChange = vi.fn();

    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{ modules: { player_kill: { enabled: true, config: {} } } }}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onConfigChange={onConfigChange}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '피 묻은 열쇠 조각' },
    });
    fireEvent.click(screen.getByLabelText('사용 가능한 아이템'));
    fireEvent.click(screen.getByRole('button', { name: '살해 요청' }));
    fireEvent.change(screen.getByLabelText('공격력'), { target: { value: '3' } });

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(onUpdate).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(
      'clue-1',
      expect.objectContaining({ name: '피 묻은 열쇠 조각' }),
      expect.any(Object),
    );
    expect(onConfigChange).toHaveBeenCalledTimes(1);
    const savedConfig = onConfigChange.mock.calls[0][0];
    expect(readClueItemEffect(savedConfig, 'clue-1')).toMatchObject({
      effect: 'kill',
      target: 'player',
      attackPower: 3,
    });
  });

  it('조사권 설정이 꺼져 있으면 단서 상세에 소비량 설정을 보여주지 않는다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: {
            deck_investigation: {
              enabled: false,
              config: {
                tokens: [{ id: 'basic-token', name: '기본 조사권', iconLabel: '권', defaultAmount: 1 }],
                decks: [],
              },
            },
          },
        }}
        flowNodes={flowNodes}
        locations={locations}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText('조사권 소비')).toBeNull();
  });

  it('조사권 설정이 켜져 있으면 배치된 단서의 소비량을 단서 상세에서 자동저장한다', async () => {
    vi.useFakeTimers();
    const onConfigChange = vi.fn();

    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: {
            deck_investigation: {
              enabled: true,
              config: {
                tokens: [{ id: 'basic-token', name: '기본 조사권', iconLabel: '권', defaultAmount: 1 }],
                decks: [],
              },
            },
          },
        }}
        flowNodes={flowNodes}
        locations={locations}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={onConfigChange}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('조사권 소비')).toBeDefined();
    expect(screen.getByText(/배치 장소:/)).toBeDefined();
    fireEvent.change(screen.getByLabelText('피 묻은 열쇠 조사권 소비량'), {
      target: { value: '3' },
    });

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    const savedConfig = onConfigChange.mock.calls[0][0];
    expect(savedConfig.modules.deck_investigation.config.decks).toEqual([
      expect.objectContaining({
        id: 'location-clue-loc-1-clue-1',
        title: '서재 - 피 묻은 열쇠 조사',
        tokenId: 'basic-token',
        tokenCost: 3,
        access: expect.objectContaining({ locationIds: ['loc-1'] }),
        cards: [{ clueId: 'clue-1', delivery: 'private_ownership' }],
      }),
    ]);
  });

  it('조사권 설정이 켜져 있어도 미배치 단서는 배치 안내만 보여준다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{
          modules: {
            deck_investigation: {
              enabled: true,
              config: {
                tokens: [{ id: 'basic-token', name: '기본 조사권', iconLabel: '권', defaultAmount: 1 }],
                decks: [],
              },
            },
          },
        }}
        flowNodes={flowNodes}
        locations={locations}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('조사권 소비')).toBeDefined();
    expect(screen.getByText('장소에 배치된 단서만 조사권 소비량을 설정할 수 있습니다.')).toBeDefined();
    expect(screen.queryByLabelText('피 묻은 열쇠 조사권 소비량')).toBeNull();
  });

  it('blur 시 대기 중인 자동저장을 즉시 실행한다', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();

    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('이름');
    fireEvent.change(nameInput, {
      target: { value: '피 묻은 열쇠 조각' },
    });
    fireEvent.blur(nameInput);

    expect(onUpdate).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(
      'clue-1',
      expect.objectContaining({ name: '피 묻은 열쇠 조각' }),
      expect.any(Object),
    );
  });

  it('자동저장 실패 토스트에서 같은 변경을 재시도할 수 있다', async () => {
    vi.useFakeTimers();
    let shouldFail = true;
    const onUpdate = vi.fn((_clueId, _body, options) => {
      if (shouldFail) {
        options?.onError?.(new Error('boom'));
        return;
      }
      options?.onSuccess?.();
    });

    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '피 묻은 열쇠 조각' },
    });
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(toastErrorMock).toHaveBeenCalled();
    const [, errorOptions] = toastErrorMock.mock.calls[0];
    expect(errorOptions.action.label).toBe('재시도');

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '다른 변경' },
    });
    shouldFail = false;
    errorOptions.action.onClick();

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[1][1]).toEqual(expect.objectContaining({ name: '피 묻은 열쇠 조각' }));
  });

  it('자동저장 재시도도 실패하면 실패 토스트를 다시 보여준다', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn((_clueId, _body, options) => {
      options?.onError?.(new Error('boom'));
    });

    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' })]}
        configJson={{}}
        flowNodes={flowNodes}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onConfigChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '피 묻은 열쇠 조각' },
    });
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    const [, firstErrorOptions] = toastErrorMock.mock.calls[0];
    firstErrorOptions.action.onClick();

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
    const [, secondErrorOptions] = toastErrorMock.mock.calls[1];
    expect(secondErrorOptions.action.label).toBe('재시도');
  });

  it('플레이어킬 모듈 상태에 따라 살해 요청 효과를 숨기거나 보여준다', () => {
    const baseProps = {
      themeId: 'theme-1',
      clues: [clue({ id: 'clue-1' })],
      flowNodes,
      locations: [],
      characters: [],
      onCreate: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    };

    const { rerender } = render(
      <ClueEntityWorkspace
        {...baseProps}
        configJson={{ modules: { player_kill: { enabled: false, config: {} } } }}
      />,
    );

    fireEvent.click(screen.getByLabelText('사용 가능한 아이템'));
    expect(screen.queryByRole('button', { name: '살해 요청' })).toBeNull();

    rerender(
      <ClueEntityWorkspace
        {...baseProps}
        configJson={{ modules: { player_kill: { enabled: true, config: {} } } }}
      />,
    );

    expect(screen.getByRole('button', { name: '살해 요청' })).toBeDefined();
  });
});
