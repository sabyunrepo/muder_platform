import type {
  EditorCharacterResponse,
  MysteryRole,
  UpdateCharacterRequest,
} from '@/features/editor/api/types';

export interface CharacterRoleOption {
  value: MysteryRole;
  label: string;
  description: string;
  spoiler: boolean;
  defaultVotingCandidate: boolean;
}

export interface CharacterEditorViewModel {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  role: MysteryRole;
  roleLabel: string;
  roleDescription: string;
  roleBadge: string;
  isSpoilerRole: boolean;
  isDefaultVotingCandidate: boolean;
  hasPublicIntro: boolean;
}

export const characterRoleOptions: CharacterRoleOption[] = [
  {
    value: 'suspect',
    label: '용의자',
    description: '일반 투표 후보입니다.',
    spoiler: false,
    defaultVotingCandidate: true,
  },
  {
    value: 'culprit',
    label: '범인',
    description: '정답 캐릭터입니다. 플레이어 화면에는 숨겨집니다.',
    spoiler: true,
    defaultVotingCandidate: true,
  },
  {
    value: 'accomplice',
    label: '공범',
    description: '범인을 돕는 캐릭터입니다. 결말 판정에서 별도로 사용할 수 있습니다.',
    spoiler: true,
    defaultVotingCandidate: true,
  },
  {
    value: 'detective',
    label: '탐정',
    description: '추리 진행자 역할입니다. 투표 후보 포함 여부는 투표 설정에서 정합니다.',
    spoiler: true,
    defaultVotingCandidate: false,
  },
];

const roleOptionMap = new Map<MysteryRole, CharacterRoleOption>(
  characterRoleOptions.map((option) => [option.value, option]),
);

export function getCharacterRoleOption(role: MysteryRole): CharacterRoleOption {
  return roleOptionMap.get(role) ?? roleOptionMap.get('suspect')!;
}

export function normalizeCharacterEditorRole(character: { mystery_role?: MysteryRole | null; is_culprit?: boolean | null }): MysteryRole {
  if (character.mystery_role) return character.mystery_role;
  return character.is_culprit ? 'culprit' : 'suspect';
}

export function toCharacterEditorViewModel(character: EditorCharacterResponse): CharacterEditorViewModel {
  const role = normalizeCharacterEditorRole(character);
  const option = getCharacterRoleOption(role);

  return {
    id: character.id,
    name: character.name,
    description: character.description?.trim() ?? '',
    imageUrl: character.image_url,
    sortOrder: character.sort_order,
    role,
    roleLabel: option.label,
    roleDescription: option.description,
    roleBadge: option.label,
    isSpoilerRole: option.spoiler,
    isDefaultVotingCandidate: option.defaultVotingCandidate,
    hasPublicIntro: Boolean(character.description?.trim() || character.image_url),
  };
}

export function toCharacterEditorViewModels(characters: EditorCharacterResponse[]): CharacterEditorViewModel[] {
  return characters.map(toCharacterEditorViewModel);
}

export function buildCharacterRoleUpdatePayload(
  character: EditorCharacterResponse,
  role: MysteryRole,
): UpdateCharacterRequest {
  return {
    name: character.name,
    description: character.description ?? undefined,
    image_url: character.image_url ?? undefined,
    is_culprit: role === 'culprit',
    mystery_role: role,
    sort_order: character.sort_order,
  };
}

export function getCharacterRoleBadge(character: { mystery_role?: MysteryRole | null; is_culprit?: boolean | null }): string {
  return getCharacterRoleOption(normalizeCharacterEditorRole(character)).label;
}
