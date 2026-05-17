import { describe, expect, it } from 'vitest';
import type { EditorCharacterResponse, LocationResponse } from '@/features/editor/api/types';
import {
  buildLocationParentOptions,
  buildLocationBadges,
  formatLocationAccessLabel,
  parseLocationRestrictedCharacterIds,
  stringifyLocationRestrictedCharacterIds,
  toLocationEditorViewModel,
} from '../locationEntityAdapter';

const characters: EditorCharacterResponse[] = [
  {
    id: 'char-1',
    theme_id: 'theme-1',
    name: '탐정 한나',
    description: null,
    image_url: null,
    is_culprit: false,
    mystery_role: 'detective',
    sort_order: 0,
    is_playable: true,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: false,
  },
  {
    id: 'char-2',
    theme_id: 'theme-1',
    name: '정원사 민수',
    description: null,
    image_url: null,
    is_culprit: false,
    mystery_role: 'suspect',
    sort_order: 1,
    is_playable: true,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: true,
  },
];

function location(overrides: Partial<LocationResponse> = {}): LocationResponse {
  return {
    id: 'loc-1',
    theme_id: 'theme-1',
    map_id: 'map-1',
    name: '서재',
    restricted_characters: null,
    image_url: null,
    sort_order: 0,
    created_at: '2026-05-03T00:00:00Z',
    appearance_scene_id: null,
    hide_scene_id: null,
    ...overrides,
  };
}

describe('locationEntityAdapter', () => {
  it('장소 API 응답을 제작자용 ViewModel으로 변환한다', () => {
    const vm = toLocationEditorViewModel(
      location({
        restricted_characters: 'char-1',
        image_url: 'https://cdn.example/study.webp',
        appearance_scene_id: 'scene-2',
        hide_scene_id: 'scene-4',
      }),
      { characters, clueCount: 3, mapName: '저택 1층' }
    );

    expect(vm).toMatchObject({
      id: 'loc-1',
      name: '서재',
      imageUrl: 'https://cdn.example/study.webp',
      roundLabel: '장면 구간 공개',
      accessLabel: '탐정 한나 접근 제한',
      clueCountLabel: '단서 조사 3개',
      clueShortLabel: '단서 3개',
      badges: ['저택 1층', '장면 구간 공개', '접근 제한 있음', '단서 3', '이미지 있음'],
    });
  });

  it('API 필드를 제작자용 공개 설명과 부모 정보로 변환한다', () => {
    const vm = toLocationEditorViewModel(
      location({
        public_description: '모든 플레이어에게 보이는 설명',
        entry_message: '차가운 바람이 분다.',
        parent_location_id: 'loc-parent',
      }),
      {
        locationMeta: {
          publicDescription: 'legacy 설명',
          entryMessage: 'legacy 진입',
          parentLocationId: 'legacy-parent',
        },
        allLocations: [location({ id: 'loc-parent', name: '저택 1층' })],
      }
    );

    expect(vm.publicDescription).toBe('모든 플레이어에게 보이는 설명');
    expect(vm.entryMessage).toBe('차가운 바람이 분다.');
    expect(vm.parentLocationId).toBe('loc-parent');
    expect(vm.parentLabel).toBe('저택 1층');
  });

  it('신규 API 필드가 비어 있으면 locationMeta fallback을 사용한다', () => {
    const vm = toLocationEditorViewModel(location(), {
      locationMeta: {
        publicDescription: '기존 설명',
        entryMessage: '기존 진입',
        parentLocationId: 'loc-parent',
      },
      allLocations: [location({ id: 'loc-parent', name: '저택 1층' })],
    });

    expect(vm.publicDescription).toBe('기존 설명');
    expect(vm.entryMessage).toBe('기존 진입');
    expect(vm.parentLocationId).toBeNull();
    expect(vm.parentLabel).toBe('최상위 장소');
  });

  it('현재 장소를 제외한 최상위 장소만 부모 후보로 제공한다', () => {
    const locations = [
      location({ id: 'loc-1', name: '저택', sort_order: 1 }),
      location({ id: 'loc-2', name: '1층', sort_order: 3 }),
      location({ id: 'loc-3', name: '서재', parent_location_id: 'loc-2', sort_order: 2 }),
      location({ id: 'loc-4', name: '정원', sort_order: 2 }),
    ];

    expect(
      buildLocationParentOptions('loc-1', locations, {
        'loc-2': { parentLocationId: 'loc-1' },
        'loc-3': { parentLocationId: 'loc-2' },
      })
    ).toEqual([
      { id: 'loc-4', label: '정원', depth: 0 },
      { id: 'loc-2', label: '1층', depth: 0 },
    ]);
  });

  it('restricted character CSV를 trim/dedupe한다', () => {
    expect(parseLocationRestrictedCharacterIds(' char-1, char-2, char-1, ')).toEqual([
      'char-1',
      'char-2',
    ]);
    expect(stringifyLocationRestrictedCharacterIds([' char-1 ', '', 'char-2', 'char-1'])).toBe(
      'char-1,char-2'
    );
  });

  it('제작자에게 내부 ID 대신 접근 요약 문구를 제공한다', () => {
    expect(formatLocationAccessLabel(null, characters)).toBe('모든 캐릭터 접근 가능');
    expect(formatLocationAccessLabel('char-unknown', characters)).toBe('1명 접근 제한');
    expect(formatLocationAccessLabel('char-1,char-2,char-3', characters)).toBe(
      '탐정 한나, 정원사 민수 외 1명 접근 제한'
    );
  });

  it('목록 배지는 맵/라운드/접근/단서/이미지 상태만 표시한다', () => {
    expect(buildLocationBadges(location(), 0, '저택 1층')).toEqual([
      '저택 1층',
      '처음부터 끝까지',
      '전체 접근',
      '단서 없음',
    ]);
  });
});
