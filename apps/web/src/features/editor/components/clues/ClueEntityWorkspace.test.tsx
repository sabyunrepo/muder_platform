import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ClueResponse, EditorCharacterResponse, LocationResponse } from '@/features/editor/api';
import { ClueEntityWorkspace } from './ClueEntityWorkspace';

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
  it('선택한 단서의 실제 편집 상세와 사용 효과를 제작자 언어로 보여준다', () => {
    render(
      <ClueEntityWorkspace
        clues={[clue({ id: 'clue-1' }), clue({ id: 'clue-2', name: '비밀 편지', is_usable: false })]}
        configJson={{
          locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
          modules: { starting_clue: { enabled: true, config: { startingClues: { 'char-1': ['clue-1'] } } } },
        }}
        locations={locations}
        characters={characters}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('단서 상세')).toBeDefined();
    expect(screen.getByText('다른 플레이어에게서 단서 가져오기')).toBeDefined();
    expect(screen.getByText('사용하면 내 단서함에서 사라짐')).toBeDefined();
    expect(screen.getByText('서재의 발견 단서')).toBeDefined();
    expect(screen.getByText('탐정의 시작 단서')).toBeDefined();
  });

  it('목록에서 다른 단서를 클릭하면 상세가 교체된다', () => {
    render(
      <ClueEntityWorkspace
        clues={[clue({ id: 'clue-1' }), clue({ id: 'clue-2', name: '비밀 편지', description: '숨겨진 메시지', is_usable: false })]}
        configJson={{}}
        locations={[]}
        characters={[]}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '비밀 편지 선택' }));

    expect(screen.getAllByText('숨겨진 메시지').length).toBeGreaterThan(0);
    expect(screen.getByText('사용 효과 없음')).toBeDefined();
  });
});
