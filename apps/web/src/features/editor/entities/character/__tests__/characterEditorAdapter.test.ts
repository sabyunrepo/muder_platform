import { describe, expect, it } from 'vitest';
import type { EditorCharacterResponse } from '@/features/editor/api/types';
import {
  buildCharacterVisibilityUpdatePayload,
  getCharacterListBadges,
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
    is_playable: true,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: true,
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
      isPlayable: true,
      characterTypeLabel: 'PC',
      showInIntro: true,
      canSpeakInReading: true,
      isVotingCandidate: true,
      visibilityBadges: ['PC', '소개 표시', '읽기 대사', '투표 후보'],
    });
  });

  it('NPC 표시 정책을 제작자용 ViewModel 배지로 변환한다', () => {
    const vm = toCharacterEditorViewModel(character({
      is_playable: false,
      show_in_intro: false,
      can_speak_in_reading: true,
      is_voting_candidate: false,
    }));

    expect(vm).toMatchObject({
      isPlayable: false,
      characterTypeLabel: 'NPC',
      showInIntro: false,
      canSpeakInReading: true,
      isVotingCandidate: false,
      visibilityBadges: ['NPC', '읽기 대사'],
    });
    expect(getCharacterListBadges(character({ is_playable: false }))).toEqual(['용의자', 'NPC']);
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
      is_playable: true,
      show_in_intro: true,
      can_speak_in_reading: true,
      is_voting_candidate: true,
    });
  });

  it('범인으로 변경할 때만 legacy is_culprit를 true로 보낸다', () => {
    expect(buildCharacterRoleUpdatePayload(character(), 'culprit').is_culprit).toBe(true);
    expect(buildCharacterRoleUpdatePayload(character(), 'detective').is_culprit).toBe(false);
  });

  it('NPC로 전환할 때 투표 후보를 함께 끈다', () => {
    const payload = buildCharacterVisibilityUpdatePayload(character(), 'is_playable', false);

    expect(payload).toMatchObject({
      is_playable: false,
      show_in_intro: true,
      can_speak_in_reading: true,
      is_voting_candidate: false,
    });
  });
});
