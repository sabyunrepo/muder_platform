import type { EditorCharacterResponse, LocationResponse } from '@/features/editor/api/types';
import { formatRoundRange } from '@/features/editor/utils/roundFormat';

export interface LocationEditorViewModel {
  id: string;
  name: string;
  imageUrl: string | null;
  roundLabel: string;
  accessLabel: string;
  clueCountLabel: string;
  badges: string[];
}

export function toLocationEditorViewModel(
  location: LocationResponse,
  options: { characters?: EditorCharacterResponse[]; clueCount?: number; mapName?: string } = {}
): LocationEditorViewModel {
  const clueCount = options.clueCount ?? 0;
  return {
    id: location.id,
    name: location.name,
    imageUrl: location.image_url ?? null,
    roundLabel: formatLocationRoundLabel(location),
    accessLabel: formatLocationAccessLabel(
      location.restricted_characters,
      options.characters ?? []
    ),
    clueCountLabel: `조사 시 발견 단서 ${clueCount}개`,
    badges: buildLocationBadges(location, clueCount, options.mapName),
  };
}

export function parseLocationRestrictedCharacterIds(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export function stringifyLocationRestrictedCharacterIds(ids: Iterable<string>): string | null {
  const normalized = Array.from(ids)
    .map((id) => id.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized.join(',') : null;
}

export function formatLocationAccessLabel(
  restrictedCharacters: string | null | undefined,
  characters: EditorCharacterResponse[]
): string {
  const restrictedIds = parseLocationRestrictedCharacterIds(restrictedCharacters);
  if (restrictedIds.length === 0) return '모든 캐릭터 접근 가능';

  const nameById = new Map(characters.map((character) => [character.id, character.name]));
  const names = restrictedIds
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return `${restrictedIds.length}명 접근 제한`;
  if (names.length === restrictedIds.length && names.length <= 2)
    return `${names.join(', ')} 접근 제한`;

  const visibleNames = names.slice(0, 2);
  const hiddenCount = restrictedIds.length - visibleNames.length;
  return `${visibleNames.join(', ')} 외 ${hiddenCount}명 접근 제한`;
}

export function formatLocationRoundLabel(
  location: Pick<LocationResponse, 'from_round' | 'until_round'>
): string {
  return formatRoundRange(location.from_round, location.until_round) || '처음부터 끝까지';
}

export function buildLocationBadges(
  location: LocationResponse,
  clueCount: number,
  mapName?: string
): string[] {
  return [
    mapName || null,
    formatLocationRoundLabel(location),
    parseLocationRestrictedCharacterIds(location.restricted_characters).length > 0
      ? '접근 제한 있음'
      : '전체 접근',
    clueCount > 0 ? `단서 ${clueCount}` : '단서 없음',
    location.image_url ? '이미지 있음' : null,
  ].filter((badge): badge is string => Boolean(badge));
}
