import type {
  CharacterAliasRule,
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
  imageMediaId: string | null;
  sortOrder: number;
  role: MysteryRole;
  roleLabel: string;
  roleDescription: string;
  roleBadge: string;
  isSpoilerRole: boolean;
  isDefaultVotingCandidate: boolean;
  hasPublicIntro: boolean;
  isPlayable: boolean;
  characterTypeLabel: string;
  showInIntro: boolean;
  canSpeakInReading: boolean;
  isVotingCandidate: boolean;
  visibilityBadges: string[];
  endcardTitle: string;
  endcardBody: string;
  endcardImageUrl: string | null;
  endcardImageMediaId: string | null;
  hasEndcard: boolean;
  aliasRules: CharacterAliasRule[];
  hasAliasRules: boolean;
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

export type CharacterVisibilityField =
  | 'is_playable'
  | 'show_in_intro'
  | 'can_speak_in_reading'
  | 'is_voting_candidate';

export function getCharacterRoleOption(role: MysteryRole): CharacterRoleOption {
  return roleOptionMap.get(role) ?? roleOptionMap.get('suspect')!;
}

export function normalizeCharacterEditorRole(character: { mystery_role?: MysteryRole | null; is_culprit?: boolean | null }): MysteryRole {
  if (character.mystery_role) return character.mystery_role;
  return character.is_culprit ? 'culprit' : 'suspect';
}

function boolOrDefault(value: boolean | undefined | null, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getCharacterVisibility(character: Partial<EditorCharacterResponse>, role: MysteryRole) {
  const roleOption = getCharacterRoleOption(role);
  const isPlayable = boolOrDefault(character.is_playable, true);

  return {
    isPlayable,
    showInIntro: boolOrDefault(character.show_in_intro, true),
    canSpeakInReading: boolOrDefault(character.can_speak_in_reading, true),
    isVotingCandidate: boolOrDefault(character.is_voting_candidate, isPlayable && roleOption.defaultVotingCandidate),
  };
}

function getVisibilityBadges(visibility: ReturnType<typeof getCharacterVisibility>): string[] {
  const badges = [visibility.isPlayable ? 'PC' : 'NPC'];
  if (visibility.showInIntro) badges.push('소개 표시');
  if (visibility.canSpeakInReading) badges.push('읽기 대사');
  if (visibility.isVotingCandidate) badges.push('투표 후보');
  return badges;
}

export function normalizeCharacterAliasRules(rules: CharacterAliasRule[] | null | undefined): CharacterAliasRule[] {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((rule) => rule && typeof rule.id === 'string' && rule.condition)
    .map((rule) => ({
      id: rule.id.trim(),
      label: rule.label?.trim() || undefined,
      display_name: rule.display_name?.trim() || undefined,
      display_icon_url: rule.display_icon_url?.trim() || undefined,
      priority: Number.isFinite(rule.priority) ? Math.max(0, Math.trunc(rule.priority)) : 0,
      condition: rule.condition,
    }))
    .filter((rule) => Boolean(rule.id && (rule.display_name || rule.display_icon_url)));
}

function getExistingEndcardPayload(character: EditorCharacterResponse): Pick<
  UpdateCharacterRequest,
  'endcard_title' | 'endcard_body' | 'endcard_image_url'
> {
  return {
    ...(character.endcard_title ? { endcard_title: character.endcard_title } : {}),
    ...(character.endcard_body ? { endcard_body: character.endcard_body } : {}),
    ...(character.endcard_image_url ? { endcard_image_url: character.endcard_image_url } : {}),
  };
}

function buildCharacterBaseUpdatePayload(character: EditorCharacterResponse, role = normalizeCharacterEditorRole(character)) {
  const visibility = getCharacterVisibility(character, role);
  return {
    name: character.name,
    description: character.description ?? undefined,
    image_url: character.image_url ?? undefined,
    is_culprit: role === 'culprit',
    mystery_role: role,
    sort_order: character.sort_order,
    is_playable: visibility.isPlayable,
    show_in_intro: visibility.showInIntro,
    can_speak_in_reading: visibility.canSpeakInReading,
    is_voting_candidate: visibility.isVotingCandidate,
    ...getExistingEndcardPayload(character),
    alias_rules: normalizeCharacterAliasRules(character.alias_rules),
  };
}

export function toCharacterEditorViewModel(character: EditorCharacterResponse): CharacterEditorViewModel {
  const role = normalizeCharacterEditorRole(character);
  const option = getCharacterRoleOption(role);
  const visibility = getCharacterVisibility(character, role);
  const aliasRules = normalizeCharacterAliasRules(character.alias_rules);

  return {
    id: character.id,
    name: character.name,
    description: character.description?.trim() ?? '',
    imageUrl: character.image_url,
    imageMediaId: character.image_media_id ?? null,
    sortOrder: character.sort_order,
    role,
    roleLabel: option.label,
    roleDescription: option.description,
    roleBadge: option.label,
    isSpoilerRole: option.spoiler,
    isDefaultVotingCandidate: option.defaultVotingCandidate,
    hasPublicIntro: Boolean(character.description?.trim() || character.image_media_id || character.image_url),
    isPlayable: visibility.isPlayable,
    characterTypeLabel: visibility.isPlayable ? 'PC' : 'NPC',
    showInIntro: visibility.showInIntro,
    canSpeakInReading: visibility.canSpeakInReading,
    isVotingCandidate: visibility.isVotingCandidate,
    visibilityBadges: getVisibilityBadges(visibility),
    endcardTitle: character.endcard_title?.trim() ?? '',
    endcardBody: character.endcard_body?.trim() ?? '',
    endcardImageUrl: character.endcard_image_url,
    endcardImageMediaId: character.endcard_image_media_id ?? null,
    hasEndcard: Boolean(
      character.endcard_title?.trim() ||
      character.endcard_body?.trim() ||
      character.endcard_image_media_id ||
      character.endcard_image_url,
    ),
    aliasRules,
    hasAliasRules: aliasRules.length > 0,
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
    ...buildCharacterBaseUpdatePayload(character, role),
  };
}

export function buildCharacterVisibilityUpdatePayload(
  character: EditorCharacterResponse,
  field: CharacterVisibilityField,
  value: boolean,
): UpdateCharacterRequest {
  const role = normalizeCharacterEditorRole(character);
  const visibility = getCharacterVisibility(character, role);
  const next = {
    is_playable: visibility.isPlayable,
    show_in_intro: visibility.showInIntro,
    can_speak_in_reading: visibility.canSpeakInReading,
    is_voting_candidate: visibility.isVotingCandidate,
    [field]: value,
  };

  if (field === 'is_playable' && !value) {
    next.is_voting_candidate = false;
  }

  return {
    ...buildCharacterBaseUpdatePayload(character, role),
    ...next,
    ...getExistingEndcardPayload(character),
  };
}

export function buildCharacterEndcardUpdatePayload(
  character: EditorCharacterResponse,
  values: { title: string; body: string; imageUrl: string; imageMediaId?: string | null },
): UpdateCharacterRequest {
  const role = normalizeCharacterEditorRole(character);
  const visibility = getCharacterVisibility(character, role);
  const title = values.title.trim();
  const body = values.body.trim();
  const imageUrl = values.imageUrl.trim();
  const imageMediaId = values.imageMediaId ?? null;

  return {
    name: character.name,
    description: character.description ?? undefined,
    image_url: character.image_url ?? undefined,
    is_culprit: role === 'culprit',
    mystery_role: role,
    sort_order: character.sort_order,
    is_playable: visibility.isPlayable,
    show_in_intro: visibility.showInIntro,
    can_speak_in_reading: visibility.canSpeakInReading,
    is_voting_candidate: visibility.isVotingCandidate,
    endcard_title: title,
    endcard_body: body,
    endcard_image_url: imageMediaId ? '' : imageUrl,
    endcard_image_media_id: imageMediaId,
  };
}

export function buildCharacterProfileImageMediaUpdatePayload(
  character: EditorCharacterResponse,
  imageMediaId: string | null,
): UpdateCharacterRequest {
  return {
    ...buildCharacterBaseUpdatePayload(character),
    image_url: imageMediaId ? '' : character.image_url ?? undefined,
    image_media_id: imageMediaId,
  };
}

export function buildCharacterAliasRulesUpdatePayload(
  character: EditorCharacterResponse,
  aliasRules: CharacterAliasRule[],
): UpdateCharacterRequest {
  return {
    ...buildCharacterBaseUpdatePayload(character),
    alias_rules: normalizeCharacterAliasRules(aliasRules),
  };
}

export function getCharacterRoleBadge(character: { mystery_role?: MysteryRole | null; is_culprit?: boolean | null }): string {
  return getCharacterRoleOption(normalizeCharacterEditorRole(character)).label;
}

export function getCharacterListBadges(character: EditorCharacterResponse): string[] {
  const role = normalizeCharacterEditorRole(character);
  const visibility = getCharacterVisibility(character, role);
  return [getCharacterRoleBadge(character), visibility.isPlayable ? 'PC' : 'NPC'];
}
