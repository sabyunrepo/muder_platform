import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ClueResponse, EditorCharacterResponse, LocationResponse } from '@/features/editor/api';
import { ClueEntityWorkspace } from './ClueEntityWorkspace';

vi.mock('@/features/editor/flowApi', () => ({
  useFlowGraph: () => ({
    data: {
      nodes: [
        { id: 'scene-1', type: 'phase', data: { label: '조사 장면' } },
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

afterEach(cleanup);

describe('ClueEntityWorkspace', () => {
  const flowNodes = [
    { id: 'scene-1', type: 'phase', data: { label: '조사 장면' } },
    { id: 'scene-2', type: 'phase', data: { label: '정리 장면' } },
    { id: 'branch-1', type: 'branch', data: { label: '이전 분기' } },
  ] as never;

  it('선택한 단서의 인라인 편집 상세와 사용 공개 규칙을 제작자 언어로 보여준다', () => {
    render(
      <ClueEntityWorkspace
        themeId="theme-1"
        clues={[clue({ id: 'clue-1' }), clue({ id: 'clue-2', name: '비밀 편지', is_usable: false })]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: { starting_clue: { enabled: true, config: { startingClues: { 'char-1': ['clue-1'] } } } },
        }}
        locations={locations}
        characters={characters}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('단서 기본 정보')).toBeDefined();
    expect(screen.getByText('단서 공개 조건')).toBeDefined();
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
    expect(screen.getByRole('button', { name: '설명 변경' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('인라인 기본 정보 저장 시 선택 단서 update payload와 보호 정책을 보낸다', () => {
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

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '피 묻은 열쇠 조각' },
    });
    fireEvent.change(screen.getByLabelText('공개 시점'), {
      target: { value: 'scene-1' },
    });
    fireEvent.change(screen.getByLabelText('숨김 시점'), {
      target: { value: 'scene-2' },
    });
    fireEvent.click(screen.getByLabelText(/단서 보호/));
    fireEvent.click(screen.getByRole('button', { name: '기본 정보 저장' }));

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
        hide_scene_id: 'scene-2',
      }),
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
    );
  });
});
