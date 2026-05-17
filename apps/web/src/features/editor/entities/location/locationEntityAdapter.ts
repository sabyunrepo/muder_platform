import type { EditorCharacterResponse, LocationResponse } from '@/features/editor/api/types';
import type { LocationMeta } from '@/features/editor/utils/entityMeta';

export interface LocationEditorViewModel {
  id: string;
  name: string;
  imageUrl: string | null;
  imageMediaId: string | null;
  roundLabel: string;
  accessLabel: string;
  publicDescription: string;
  entryMessage: string;
  parentLocationId: string | null;
  parentLabel: string;
  clueCountLabel: string;
  clueShortLabel: string;
  badges: string[];
}

export interface LocationParentOption {
  id: string;
  label: string;
  depth: number;
}

export function toLocationEditorViewModel(
  location: LocationResponse,
  options: {
    characters?: EditorCharacterResponse[];
    clueCount?: number;
    mapName?: string;
    locationMeta?: LocationMeta;
    allLocations?: LocationResponse[];
  } = {}
): LocationEditorViewModel {
  const clueCount = options.clueCount ?? 0;
  const parent = location.parent_location_id
    ? options.allLocations?.find((candidate) => candidate.id === location.parent_location_id)
    : null;
  return {
    id: location.id,
    name: location.name,
    imageUrl: location.image_url ?? null,
    imageMediaId: location.image_media_id ?? null,
    roundLabel: formatLocationRoundLabel(location),
    accessLabel: formatLocationAccessLabel(
      location.restricted_characters,
      options.characters ?? []
    ),
    publicDescription: normalizeMetaText(
      location.public_description ?? options.locationMeta?.publicDescription
    ),
    entryMessage: normalizeMetaText(location.entry_message ?? options.locationMeta?.entryMessage),
    parentLocationId: location.parent_location_id ?? null,
    parentLabel: parent ? parent.name : '최상위 장소',
    clueCountLabel: `단서 조사 ${clueCount}개`,
    clueShortLabel: `단서 ${clueCount}개`,
    badges: buildLocationBadges(location, clueCount, options.mapName),
  };
}

export function buildLocationParentOptions(
  currentLocationId: string,
  locations: LocationResponse[],
  metaByLocationId: Record<string, LocationMeta | undefined> = {}
): LocationParentOption[] {
  void metaByLocationId;
  return locations
    .filter((location) => location.id !== currentLocationId)
    .filter((location) => !location.parent_location_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko'))
    .map((location) => ({ id: location.id, label: location.name, depth: 0 }));
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
  const normalized = parseLocationRestrictedCharacterIds(Array.from(ids).join(','));
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
  location: Pick<LocationResponse, 'appearance_scene_id' | 'hide_scene_id'>
): string {
  if (!location.appearance_scene_id && !location.hide_scene_id) return '처음부터 끝까지';
  if (location.appearance_scene_id && location.hide_scene_id) return '장면 구간 공개';
  if (location.appearance_scene_id) return '선택 장면부터';
  return '선택 장면까지';
}

function normalizeMetaText(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
    location.image_media_id || location.image_url ? '이미지 있음' : null,
  ].filter((badge): badge is string => Boolean(badge));
}
