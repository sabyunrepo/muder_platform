// ---------------------------------------------------------------------------
// editorTypes.ts
//
// Editor-side schema extensions that live inside `theme.config_json`. These
// types shape the JSON blob owned by the editor UI and persisted through
// `PUT /v1/editor/themes/{id}/config` (see `editorConfigApi.useUpdateConfigJson`).
//
// They are deliberately separate from the API response types in `api.ts`
// (`LocationResponse`, `ClueResponse`, etc.) which describe rows stored in
// dedicated tables. Anything here is config-only: the backend round-trips it
// as opaque JSON until Phase 18.5 wires the runtime engine.
// ---------------------------------------------------------------------------

/**
 * Design-time Location entry nested inside `config_json.locations[]`.
 *
 * mini-spec: `clueIds` is the list of clue IDs placed at this location. The
 * runtime engine (Phase 18.5) will consume this list to seed discoverable
 * clues when players enter the location. Optional for backward compatibility
 * with existing themes that predate this field.
 */
export interface EditorLocationConfig {
  /** Location row id (matches `LocationResponse.id`). */
  id: string;
  /** Display name mirror; engine may prefer `LocationResponse.name`. */
  name?: string;
  /**
   * Clue ids placed at this location. Consumed by the runtime engine
   * (Phase 18.5). Empty array and `undefined` are both treated as "no clues
   * assigned".
   */
  clueIds?: string[];
}

/**
 * Shape of `theme.config_json.locations` as authored in the design tab.
 * Stored as an array so insertion order is preserved.
 */
export type EditorLocationsConfig = EditorLocationConfig[];

/**
 * Extract the `locations` array from a theme config blob. Returns `[]` when
 * the field is missing or malformed so callers can treat the happy path
 * uniformly.
 */
export function readLocationsConfig(
  configJson: Record<string, unknown> | null | undefined,
): EditorLocationsConfig {
  const raw = configJson?.locations;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is EditorLocationConfig =>
      !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string',
  );
}

/**
 * Return the `clueIds` assigned to `locationId` inside a config blob. Returns
 * `[]` when the location entry is missing or has no clues yet.
 */
export function readLocationClueIds(
  configJson: Record<string, unknown> | null | undefined,
  locationId: string,
): string[] {
  const entry = readLocationsConfig(configJson).find((l) => l.id === locationId);
  const ids = entry?.clueIds;
  return Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Immutably upsert a location entry's `clueIds` inside a config blob. Returns
 * the next `config_json` object suitable for `useUpdateConfigJson.mutate`.
 *
 * - Preserves sibling config fields (spread of the input).
 * - Preserves sibling location entries; upserts the matching `locationId`.
 * - Inserts a new entry with `{ id, clueIds }` when the location is absent.
 */
export function writeLocationClueIds(
  configJson: Record<string, unknown> | null | undefined,
  locationId: string,
  clueIds: string[],
): Record<string, unknown> {
  const base = configJson ?? {};
  const locations = readLocationsConfig(base);
  const idx = locations.findIndex((l) => l.id === locationId);
  const nextLocations: EditorLocationsConfig =
    idx >= 0
      ? locations.map((l, i) => (i === idx ? { ...l, clueIds } : l))
      : [...locations, { id: locationId, clueIds }];
  return { ...base, locations: nextLocations };
}
