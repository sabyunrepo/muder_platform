import { normalizeConfigForSave, type EditorConfig } from './configShape';

export interface LocationMeta extends Record<string, unknown> {
  parentLocationId?: string | null;
  entryMessage?: string;
  imageUrl?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readLocationMetaMap(
  configJson: EditorConfig | null | undefined,
): Record<string, LocationMeta> {
  const raw = configJson?.locationMeta;
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, LocationMeta] => isRecord(entry[1])),
  );
}

export function readLocationMeta(
  configJson: EditorConfig | null | undefined,
  locationId: string,
): LocationMeta {
  return { ...(readLocationMetaMap(configJson)[locationId] ?? {}) };
}

export function writeLocationMeta(
  configJson: EditorConfig | null | undefined,
  locationId: string,
  patch: LocationMeta,
): EditorConfig {
  const next = normalizeConfigForSave(configJson);
  const map = readLocationMetaMap(next);
  const current = map[locationId] ?? {};
  const merged: LocationMeta = { ...current, ...patch };

  if (merged.parentLocationId === locationId) {
    delete merged.parentLocationId;
  }

  return {
    ...next,
    locationMeta: {
      ...map,
      [locationId]: merged,
    },
  };
}

export function parseRestrictedCharacterIds(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatRestrictedCharacterIds(ids: string[]): string | null {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  return unique.length > 0 ? unique.join(',') : null;
}
