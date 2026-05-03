// ---------------------------------------------------------------------------
// Phase 24 editor config shape bridge
// ---------------------------------------------------------------------------

export type EditorConfig = Record<string, unknown>;

export interface ModuleEntry extends Record<string, unknown> {
  enabled?: boolean;
  config?: EditorConfig;
}

export interface LocationConfig extends Record<string, unknown> {
  id: string;
  name?: string;
  locationClueConfig?: { clueIds?: string[] } & EditorConfig;
  clueIds?: string[];
}

const LEGACY_KEYS = ['module_configs', 'clue_placement', 'character_clues'] as const;

function isRecord(value: unknown): value is EditorConfig {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnKey<T extends string>(
  value: EditorConfig | null | undefined,
  key: T,
): value is EditorConfig & Record<T, unknown> {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function readLegacyModuleConfigs(configJson: EditorConfig | null | undefined) {
  const raw = configJson?.module_configs;
  return isRecord(raw) ? (raw as Record<string, EditorConfig>) : {};
}

export function readModulesMap(
  configJson: EditorConfig | null | undefined,
): Record<string, ModuleEntry> {
  const rawModules = configJson?.modules;
  const legacyConfigs = readLegacyModuleConfigs(configJson);

  if (isRecord(rawModules)) {
    const entries: Record<string, ModuleEntry> = {};
    for (const [id, rawEntry] of Object.entries(rawModules)) {
      const entry = isRecord(rawEntry) ? (rawEntry as ModuleEntry) : {};
      entries[id] = {
        ...entry,
        enabled: entry.enabled !== false,
        config: isRecord(entry.config) ? entry.config : legacyConfigs[id],
      };
    }
    for (const [id, cfg] of Object.entries(legacyConfigs)) {
      entries[id] ??= { enabled: true, config: cfg };
    }
    return entries;
  }

  const ids = stringList(rawModules);
  const entries: Record<string, ModuleEntry> = {};
  for (const id of ids) {
    entries[id] = { enabled: true, config: legacyConfigs[id] };
  }
  for (const [id, cfg] of Object.entries(legacyConfigs)) {
    entries[id] ??= { enabled: true, config: cfg };
  }
  return entries;
}

export function readEnabledModuleIds(
  configJson: EditorConfig | null | undefined,
): string[] {
  return Object.entries(readModulesMap(configJson))
    .filter(([, entry]) => entry.enabled !== false)
    .map(([id]) => id);
}

export function readModuleConfig(
  configJson: EditorConfig | null | undefined,
  moduleId: string,
): EditorConfig {
  const cfg = readModulesMap(configJson)[moduleId]?.config;
  return isRecord(cfg) ? cfg : {};
}

function stripLegacyConfigKeys(configJson: EditorConfig): EditorConfig {
  const next: EditorConfig = { ...configJson };
  for (const key of LEGACY_KEYS) delete next[key];

  const rawLocations = next.locations;
  if (Array.isArray(rawLocations)) {
    next.locations = rawLocations.map((item) => {
      if (!isRecord(item)) return item;
      const { clueIds, ...rest } = item as LocationConfig;
      const existing = isRecord(rest.locationClueConfig) ? rest.locationClueConfig : {};
      const hasCanonical = hasOwnKey(existing, 'clueIds');
      const ids = hasCanonical ? stringList(existing.clueIds) : stringList(clueIds);
      return hasCanonical || ids.length > 0
        ? { ...rest, locationClueConfig: { ...existing, clueIds: ids } }
        : rest;
    });
  }

  return next;
}

export function normalizeConfigForSave(
  configJson: EditorConfig | null | undefined,
): EditorConfig {
  const base = configJson ?? {};
  return stripLegacyConfigKeys({ ...base, modules: readModulesMap(base) });
}

export function writeModuleEnabled(
  configJson: EditorConfig | null | undefined,
  moduleId: string,
  enabled: boolean,
): EditorConfig {
  const next = normalizeConfigForSave(configJson);
  const modules = readModulesMap(next);
  modules[moduleId] = { ...(modules[moduleId] ?? {}), enabled };
  return { ...next, modules };
}

export function writeModuleConfig(
  configJson: EditorConfig | null | undefined,
  moduleId: string,
  moduleConfig: EditorConfig,
): EditorConfig {
  const next = normalizeConfigForSave(configJson);
  const modules = readModulesMap(next);
  modules[moduleId] = {
    ...(modules[moduleId] ?? {}),
    enabled: modules[moduleId]?.enabled ?? true,
    config: moduleConfig,
  };
  return { ...next, modules };
}

function writePath(base: EditorConfig, path: string, value: unknown): EditorConfig {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return base;

  const [head, ...tail] = keys;
  if (tail.length === 0) {
    return { ...base, [head]: value };
  }

  const child = isRecord(base[head]) ? (base[head] as EditorConfig) : {};
  return { ...base, [head]: writePath(child, tail.join('.'), value) };
}

export function writeModuleConfigPath(
  configJson: EditorConfig | null | undefined,
  moduleId: string,
  path: string,
  value: unknown,
): EditorConfig {
  const current = readModuleConfig(configJson, moduleId);
  return writeModuleConfig(configJson, moduleId, writePath(current, path, value));
}

export function readLocationsConfig(
  configJson: EditorConfig | null | undefined,
): LocationConfig[] {
  const raw = configJson?.locations;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is LocationConfig => isRecord(item) && typeof item.id === 'string',
  );
}

export function readLocationClueIds(
  configJson: EditorConfig | null | undefined,
  locationId: string,
): string[] {
  const entry = readLocationsConfig(configJson).find((loc) => loc.id === locationId);
  const canonical = entry?.locationClueConfig?.clueIds;
  if (hasOwnKey(entry?.locationClueConfig, 'clueIds')) return stringList(canonical);
  return stringList(entry?.clueIds);
}

export function writeLocationClueIds(
  configJson: EditorConfig | null | undefined,
  locationId: string,
  clueIds: string[],
): EditorConfig {
  const next = normalizeConfigForSave(configJson);
  const locations = readLocationsConfig(next);
  const idx = locations.findIndex((loc) => loc.id === locationId);
  const cleanIds = Array.from(new Set(clueIds));
  const upsert = (loc: LocationConfig): LocationConfig => ({
    ...loc,
    locationClueConfig: { ...(loc.locationClueConfig ?? {}), clueIds: cleanIds },
  });
  const nextLocations = idx >= 0
    ? locations.map((loc, i) => (i === idx ? upsert(loc) : loc))
    : [...locations, { id: locationId, locationClueConfig: { clueIds: cleanIds } }];
  return { ...next, locations: nextLocations };
}

export function readCluePlacement(
  configJson: EditorConfig | null | undefined,
): Record<string, string> {
  const placement: Record<string, string> = {};
  const locations = readLocationsConfig(configJson);
  for (const loc of locations) {
    for (const clueId of readLocationClueIds(configJson, loc.id)) placement[clueId] = loc.id;
  }
  if (Array.isArray(configJson?.locations)) return placement;

  const legacy = configJson?.clue_placement;
  if (!isRecord(legacy)) return {};
  return Object.fromEntries(
    Object.entries(legacy).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

export function writeCluePlacement(
  configJson: EditorConfig | null | undefined,
  placement: Record<string, string>,
): EditorConfig {
  let next = normalizeConfigForSave(configJson);
  const locationIds = new Set([
    ...readLocationsConfig(next).map((loc) => loc.id),
    ...Object.values(placement),
  ]);
  for (const locationId of locationIds) {
    const ids = Object.entries(placement)
      .filter(([, locId]) => locId === locationId)
      .map(([clueId]) => clueId);
    next = writeLocationClueIds(next, locationId, ids);
  }
  return next;
}

export function readCharacterStartingClueMap(
  configJson: EditorConfig | null | undefined,
): Record<string, string[]> {
  const startingConfig = readModuleConfig(configJson, 'starting_clue');
  if (hasOwnKey(startingConfig, 'startingClues')) {
    return isRecord(startingConfig.startingClues)
      ? Object.fromEntries(
        Object.entries(startingConfig.startingClues).map(([charId, ids]) => [
          charId,
          stringList(ids),
        ]),
      )
      : {};
  }

  const source = configJson?.character_clues;
  if (!isRecord(source)) return {};
  return Object.fromEntries(
    Object.entries(source).map(([charId, ids]) => [charId, stringList(ids)]),
  );
}

export function writeCharacterStartingClueMap(
  configJson: EditorConfig | null | undefined,
  startingClues: Record<string, string[]>,
): EditorConfig {
  const current = readModuleConfig(configJson, 'starting_clue');
  return writeModuleConfig(configJson, 'starting_clue', { ...current, startingClues });
}

function removeClueIdFromValue(value: unknown, clueId: string): unknown {
  if (typeof value === 'string') return value === clueId ? undefined : value;
  if (Array.isArray(value)) {
    return value
      .map((item) => removeClueIdFromValue(item, clueId))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key, removeClueIdFromValue(child, clueId)] as const)
      .filter(([, child]) => child !== undefined),
  );
}

export function removeClueReferencesFromConfig(
  configJson: EditorConfig | null | undefined,
  clueId: string,
): EditorConfig {
  const normalized = normalizeConfigForSave(configJson);
  return removeClueIdFromValue(normalized, clueId) as EditorConfig;
}
