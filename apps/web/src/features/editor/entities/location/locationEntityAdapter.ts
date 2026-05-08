import type { EditorCharacterResponse, LocationResponse } from '@/features/editor/api/types';
import { formatRoundRange } from '@/features/editor/utils/roundFormat';
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
  const parentLocationId = normalizeParentLocationId(
    location.id,
    location.parent_location_id ?? options.locationMeta?.parentLocationId
  );
  const parentLocation = options.allLocations?.find((item) => item.id === parentLocationId);
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
    parentLocationId,
    parentLabel: parentLocation?.name ?? '최상위 장소',
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
  const blocked = collectDescendantLocationIds(currentLocationId, locations, metaByLocationId);
  return locations
    .filter((location) => location.id !== currentLocationId && !blocked.has(location.id))
    .map((location) => ({
      id: location.id,
      label: location.name,
      depth: getLocationDepth(location.id, locations, metaByLocationId, new Set<string>()),
    }));
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
  location: Pick<LocationResponse, 'from_round' | 'until_round'>
): string {
  return formatRoundRange(location.from_round, location.until_round) || '처음부터 끝까지';
}

function normalizeMetaText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeParentLocationId(
  currentLocationId: string,
  parentLocationId: unknown
): string | null {
  if (typeof parentLocationId !== 'string') return null;
  const trimmed = parentLocationId.trim();
  if (!trimmed || trimmed === currentLocationId) return null;
  return trimmed;
}

function collectDescendantLocationIds(
  currentLocationId: string,
  locations: LocationResponse[],
  metaByLocationId: Record<string, LocationMeta | undefined>
): Set<string> {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const location of locations) {
      if (descendants.has(location.id)) continue;
      const parentId = normalizeParentLocationId(
        location.id,
        metaByLocationId[location.id]?.parentLocationId
      );
      if (parentId === currentLocationId || (parentId != null && descendants.has(parentId))) {
        descendants.add(location.id);
        changed = true;
      }
    }
  }
  return descendants;
}

function getLocationDepth(
  locationId: string,
  locations: LocationResponse[],
  metaByLocationId: Record<string, LocationMeta | undefined>,
  seen: Set<string>
): number {
  if (seen.has(locationId)) return 0;
  seen.add(locationId);
  const location = locations.find((item) => item.id === locationId);
  if (!location) return 0;
  const parentId = normalizeParentLocationId(
    location.id,
    metaByLocationId[location.id]?.parentLocationId
  );
  if (!parentId) return 0;
  return 1 + getLocationDepth(parentId, locations, metaByLocationId, seen);
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
