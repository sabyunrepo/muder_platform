import { describe, expect, it } from 'vitest';
import type { EditorCharacterResponse } from '@/features/editor/api/types';
import {
  buildCharacterRoleUpdatePayload,
  getCharacterRoleBadge,
  normalizeCharacterEditorRole,
  toCharacterEditorViewModel,
} from '../characterEditorAdapter';

function character(overrides: Partial<EditorCharacterResponse> = {}): EditorCharacterResponse {
  return {
    id: 'char-1',
    theme_id: 'theme-1',
    name: '홍길동',
    description: '공개 소개',
    image_url: null,
    is_culprit: false,
    mystery_role: 'suspect',
    sort_order: 3,
    ...overrides,
  };
}

describe('characterEditorAdapter', () => {
  it('API 캐릭터를 제작자용 ViewModel로 변환한다', () => {
    const vm = toCharacterEditorViewModel(character({ mystery_role: 'detective', image_url: 'https://cdn.example/detective.webp' }));

    expect(vm).toMatchObject({
      id: 'char-1',
      name: '홍길동',
      description: '공개 소개',
      imageUrl: 'https://cdn.example/detective.webp',
      role: 'detective',
      roleLabel: '탐정',
      roleBadge: '탐정',
      isSpoilerRole: true,
      isDefaultVotingCandidate: false,
      hasPublicIntro: true,
    });
  });

  it('legacy is_culprit 플래그만 있어도 범인 역할로 보존한다', () => {
    expect(normalizeCharacterEditorRole(character({ mystery_role: undefined as unknown as EditorCharacterResponse['mystery_role'], is_culprit: true }))).toBe('culprit');
    expect(getCharacterRoleBadge(character({ mystery_role: undefined as unknown as EditorCharacterResponse['mystery_role'], is_culprit: true }))).toBe('범인');
  });

  it('역할 변경 저장 payload에서 mystery_role과 is_culprit를 일관되게 만든다', () => {
    const payload = buildCharacterRoleUpdatePayload(character({ image_url: 'https://cdn.example/a.webp' }), 'accomplice');

    expect(payload).toEqual({
      name: '홍길동',
      description: '공개 소개',
      image_url: 'https://cdn.example/a.webp',
      is_culprit: false,
      mystery_role: 'accomplice',
      sort_order: 3,
    });
  });

  it('범인으로 변경할 때만 legacy is_culprit를 true로 보낸다', () => {
    expect(buildCharacterRoleUpdatePayload(character(), 'culprit').is_culprit).toBe(true);
    expect(buildCharacterRoleUpdatePayload(character(), 'detective').is_culprit).toBe(false);
  });
});
