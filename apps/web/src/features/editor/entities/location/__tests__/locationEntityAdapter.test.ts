import { describe, expect, it } from 'vitest';
import type { EditorCharacterResponse, LocationResponse } from '@/features/editor/api/types';
import {
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
    from_round: null,
    until_round: null,
    ...overrides,
  };
}

describe('locationEntityAdapter', () => {
  it('장소 API 응답을 제작자용 ViewModel으로 변환한다', () => {
    const vm = toLocationEditorViewModel(
      location({
        restricted_characters: 'char-1',
        image_url: 'https://cdn.example/study.webp',
        from_round: 2,
        until_round: 4,
      }),
      { characters, clueCount: 3, mapName: '저택 1층' }
    );

    expect(vm).toMatchObject({
      id: 'loc-1',
      name: '서재',
      imageUrl: 'https://cdn.example/study.webp',
      roundLabel: 'R2~4',
      accessLabel: '탐정 한나 접근 제한',
      clueCountLabel: '조사 시 발견 단서 3개',
      clueShortLabel: '단서 3개',
      badges: ['저택 1층', 'R2~4', '접근 제한 있음', '단서 3', '이미지 있음'],
    });
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
