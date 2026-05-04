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

export interface LocationDiscoveryConfig extends EditorConfig {
  id?: string;
  locationId: string;
  clueId: string;
  requiredClueIds: string[];
  oncePerPlayer: boolean;
}

export type ClueItemEffectKind = 'peek' | 'reveal' | 'grant_clue';

export interface ClueItemEffectConfig extends EditorConfig {
  effect: ClueItemEffectKind;
  target?: 'player' | 'self';
  consume?: boolean;
  revealText?: string;
  grantClueIds?: string[];
}

const LEGACY_KEYS = ['module_configs', 'clue_placement', 'character_clues'] as const;
const CLUE_INTERACTION_MODULE_ID = 'clue_interaction';
const CLUE_ITEM_EFFECTS_KEY = 'itemEffects';
const LOCATION_MODULE_ID = 'location';
const LOCATION_DISCOVERIES_KEY = 'discoveries';

function isRecord(value: unknown): value is EditorConfig {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnKey<T extends string>(
  value: EditorConfig | null | undefined,
  key: T
): value is EditorConfig & Record<T, unknown> {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function readClueItemEffectConfig(value: unknown): ClueItemEffectConfig | null {
  if (!isRecord(value)) return null;

  const effect = value.effect;
  if (effect !== 'peek' && effect !== 'reveal' && effect !== 'grant_clue') return null;

  const target = value.target === 'player' || value.target === 'self' ? value.target : undefined;
  const consume = typeof value.consume === 'boolean' ? value.consume : undefined;
  const revealText = typeof value.revealText === 'string' ? value.revealText : undefined;
  const grantClueIds = stringList(value.grantClueIds);

  return {
    ...value,
    effect,
    ...(target ? { target } : {}),
    ...(consume !== undefined ? { consume } : {}),
    ...(revealText !== undefined ? { revealText } : {}),
    ...(grantClueIds.length > 0 ? { grantClueIds } : {}),
  };
}

function readRawClueItemEffects(
  configJson: EditorConfig | null | undefined
): Record<string, unknown> {
  const moduleConfig = readModuleConfig(configJson, CLUE_INTERACTION_MODULE_ID);
  const rawEffects = moduleConfig[CLUE_ITEM_EFFECTS_KEY];
  return isRecord(rawEffects) ? { ...rawEffects } : {};
}

function stripKnownClueEffectFields(value: unknown): EditorConfig {
  if (!isRecord(value)) return {};
  const next = { ...value };
  delete next.effect;
  delete next.target;
  delete next.consume;
  delete next.revealText;
  delete next.grantClueIds;
  return next;
}

function readLegacyModuleConfigs(configJson: EditorConfig | null | undefined) {
  const raw = configJson?.module_configs;
  return isRecord(raw) ? (raw as Record<string, EditorConfig>) : {};
}

export function readModulesMap(
  configJson: EditorConfig | null | undefined
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

export function readEnabledModuleIds(configJson: EditorConfig | null | undefined): string[] {
  return Object.entries(readModulesMap(configJson))
    .filter(([, entry]) => entry.enabled !== false)
    .map(([id]) => id);
}

export function readModuleConfig(
  configJson: EditorConfig | null | undefined,
  moduleId: string
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

export function normalizeConfigForSave(configJson: EditorConfig | null | undefined): EditorConfig {
  const base = configJson ?? {};
  return stripLegacyConfigKeys({ ...base, modules: readModulesMap(base) });
}

export function writeModuleEnabled(
  configJson: EditorConfig | null | undefined,
  moduleId: string,
  enabled: boolean
): EditorConfig {
  const next = normalizeConfigForSave(configJson);
  const modules = readModulesMap(next);
  modules[moduleId] = { ...(modules[moduleId] ?? {}), enabled };
  return { ...next, modules };
}

export function writeModuleConfig(
  configJson: EditorConfig | null | undefined,
  moduleId: string,
  moduleConfig: EditorConfig
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
  value: unknown
): EditorConfig {
  const current = readModuleConfig(configJson, moduleId);
  return writeModuleConfig(configJson, moduleId, writePath(current, path, value));
}

export function readClueItemEffects(
  configJson: EditorConfig | null | undefined
): Record<string, ClueItemEffectConfig> {
  const moduleConfig = readModuleConfig(configJson, CLUE_INTERACTION_MODULE_ID);
  const rawEffects = moduleConfig[CLUE_ITEM_EFFECTS_KEY];
  if (!isRecord(rawEffects)) return {};

  return Object.fromEntries(
    Object.entries(rawEffects)
      .map(([clueId, rawConfig]) => [clueId, readClueItemEffectConfig(rawConfig)] as const)
      .filter((entry): entry is [string, ClueItemEffectConfig] => !!entry[1])
  );
}

export function readClueItemEffect(
  configJson: EditorConfig | null | undefined,
  clueId: string
): ClueItemEffectConfig | null {
  return readClueItemEffects(configJson)[clueId] ?? null;
}

export function writeClueItemEffect(
  configJson: EditorConfig | null | undefined,
  clueId: string,
  effectConfig: ClueItemEffectConfig | null
): EditorConfig {
  const current = readModuleConfig(configJson, CLUE_INTERACTION_MODULE_ID);
  const itemEffects = readRawClueItemEffects(configJson);

  if (effectConfig) {
    itemEffects[clueId] = {
      ...stripKnownClueEffectFields(itemEffects[clueId]),
      ...effectConfig,
    };
  } else {
    if (!hasOwnKey(current, CLUE_ITEM_EFFECTS_KEY) || !hasOwnKey(itemEffects, clueId)) {
      return configJson ?? {};
    }
    delete itemEffects[clueId];
  }

  return writeModuleConfig(configJson, CLUE_INTERACTION_MODULE_ID, {
    ...current,
    [CLUE_ITEM_EFFECTS_KEY]: itemEffects,
  });
}

export function readLocationsConfig(configJson: EditorConfig | null | undefined): LocationConfig[] {
  const raw = configJson?.locations;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is LocationConfig => isRecord(item) && typeof item.id === 'string'
  );
}

function readRawLocationDiscoveries(
  configJson: EditorConfig | null | undefined
): LocationDiscoveryConfig[] {
  const moduleConfig = readModuleConfig(configJson, LOCATION_MODULE_ID);
  const rawDiscoveries = moduleConfig[LOCATION_DISCOVERIES_KEY];
  if (!Array.isArray(rawDiscoveries)) return [];

  return rawDiscoveries
    .map((raw): LocationDiscoveryConfig | null => {
      if (!isRecord(raw)) return null;
      const locationId = typeof raw.locationId === 'string' ? raw.locationId : '';
      const clueId = typeof raw.clueId === 'string' ? raw.clueId : '';
      if (!locationId || !clueId) return null;

      return {
        ...raw,
        ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
        locationId,
        clueId,
        requiredClueIds: uniqueStrings(
          stringList(raw.requiredClueIds).filter((id) => id !== clueId)
        ),
        oncePerPlayer: typeof raw.oncePerPlayer === 'boolean' ? raw.oncePerPlayer : true,
      };
    })
    .filter((entry): entry is LocationDiscoveryConfig => !!entry);
}

function rawLocationDiscoveries(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : [];
}

function validRawLocationDiscovery(value: unknown): LocationDiscoveryConfig | null {
  if (!isRecord(value)) return null;
  const locationId = typeof value.locationId === 'string' ? value.locationId : '';
  const clueId = typeof value.clueId === 'string' ? value.clueId : '';
  if (!locationId || !clueId) return null;
  return {
    ...value,
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    locationId,
    clueId,
    requiredClueIds: uniqueStrings(stringList(value.requiredClueIds).filter((id) => id !== clueId)),
    oncePerPlayer: typeof value.oncePerPlayer === 'boolean' ? value.oncePerPlayer : true,
  };
}

export function readLocationDiscoveries(
  configJson: EditorConfig | null | undefined,
  locationId: string
): LocationDiscoveryConfig[] {
  const discoveries = readRawLocationDiscoveries(configJson).filter(
    (discovery) => discovery.locationId === locationId
  );
  const seenClueIds = new Set(discoveries.map((discovery) => discovery.clueId));
  const legacyDiscoveries = readLegacyLocationClueIds(configJson, locationId)
    .filter((clueId) => !seenClueIds.has(clueId))
    .map((clueId) => ({
      locationId,
      clueId,
      requiredClueIds: [],
      oncePerPlayer: true,
    }));

  const locationModuleConfig = readModuleConfig(configJson, LOCATION_MODULE_ID);
  if (hasOwnKey(locationModuleConfig, LOCATION_DISCOVERIES_KEY)) {
    return [...discoveries, ...legacyDiscoveries];
  }

  return readLegacyLocationClueIds(configJson, locationId).map((clueId) => ({
    locationId,
    clueId,
    requiredClueIds: [],
    oncePerPlayer: true,
  }));
}

function readLegacyLocationClueIds(
  configJson: EditorConfig | null | undefined,
  locationId: string
): string[] {
  const entry = readLocationsConfig(configJson).find((loc) => loc.id === locationId);
  const canonical = entry?.locationClueConfig?.clueIds;
  if (hasOwnKey(entry?.locationClueConfig, 'clueIds')) return stringList(canonical);
  return stringList(entry?.clueIds);
}

export function readLocationClueIds(
  configJson: EditorConfig | null | undefined,
  locationId: string
): string[] {
  return readLocationDiscoveries(configJson, locationId).map((discovery) => discovery.clueId);
}

export function writeLocationClueIds(
  configJson: EditorConfig | null | undefined,
  locationId: string,
  clueIds: string[]
): EditorConfig {
  const next = normalizeConfigForSave(configJson);
  const locations = readLocationsConfig(next);
  const idx = locations.findIndex((loc) => loc.id === locationId);
  const cleanIds = Array.from(new Set(clueIds));
  const upsert = (loc: LocationConfig): LocationConfig => ({
    ...loc,
    locationClueConfig: { ...(loc.locationClueConfig ?? {}), clueIds: cleanIds },
  });
  const nextLocations =
    idx >= 0
      ? locations.map((loc, i) => (i === idx ? upsert(loc) : loc))
      : [...locations, { id: locationId, locationClueConfig: { clueIds: cleanIds } }];
  return { ...next, locations: nextLocations };
}

function runtimeLocationDefs(existing: unknown, locations: LocationConfig[]): EditorConfig[] {
  const existingById = new Map<string, EditorConfig>();
  if (Array.isArray(existing)) {
    for (const item of existing) {
      if (isRecord(item) && typeof item.id === 'string') existingById.set(item.id, item);
    }
  }

  return locations.map((loc) => {
    const existingLoc = existingById.get(loc.id) ?? {};
    return {
      ...existingLoc,
      id: loc.id,
      name: typeof loc.name === 'string' && loc.name.trim() ? loc.name : loc.id,
    };
  });
}

function normalizeLocationDiscoveries(
  locationId: string,
  discoveries: LocationDiscoveryConfig[]
): LocationDiscoveryConfig[] {
  const seen = new Set<string>();
  const clean: LocationDiscoveryConfig[] = [];
  for (const discovery of discoveries) {
    if (!discovery.clueId || seen.has(discovery.clueId)) continue;
    seen.add(discovery.clueId);
    clean.push({
      ...discovery,
      locationId,
      clueId: discovery.clueId,
      requiredClueIds: uniqueStrings(
        stringList(discovery.requiredClueIds).filter((id) => id !== discovery.clueId)
      ),
      oncePerPlayer: true,
    });
  }
  return clean;
}

export function writeLocationDiscoveries(
  configJson: EditorConfig | null | undefined,
  locationId: string,
  discoveries: LocationDiscoveryConfig[]
): EditorConfig {
  const cleanDiscoveries = normalizeLocationDiscoveries(locationId, discoveries);
  const next = writeLocationClueIds(
    configJson,
    locationId,
    cleanDiscoveries.map((discovery) => discovery.clueId)
  );
  const current = readModuleConfig(next, LOCATION_MODULE_ID);
  const preservedRawDiscoveries = rawLocationDiscoveries(current[LOCATION_DISCOVERIES_KEY]).filter(
    (raw) => !isRecord(raw) || raw.locationId !== locationId
  );
  const preservedValidDiscoveries = preservedRawDiscoveries
    .map(validRawLocationDiscovery)
    .filter((entry): entry is LocationDiscoveryConfig => !!entry);
  const promotedLegacyDiscoveries = readLocationsConfig(next)
    .filter((loc) => loc.id !== locationId)
    .flatMap((loc) => {
      const existingClueIds = new Set(
        preservedValidDiscoveries
          .filter((discovery) => discovery.locationId === loc.id)
          .map((discovery) => discovery.clueId)
      );
      return readLegacyLocationClueIds(next, loc.id)
        .filter((clueId) => !existingClueIds.has(clueId))
        .map((clueId) => ({
          locationId: loc.id,
          clueId,
          requiredClueIds: [],
          oncePerPlayer: true,
        }));
    });

  return writeModuleConfig(next, LOCATION_MODULE_ID, {
    ...current,
    locations: runtimeLocationDefs(current.locations, readLocationsConfig(next)),
    [LOCATION_DISCOVERIES_KEY]: [
      ...preservedRawDiscoveries,
      ...promotedLegacyDiscoveries,
      ...cleanDiscoveries,
    ],
  });
}

export function readCluePlacement(
  configJson: EditorConfig | null | undefined
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
    Object.entries(legacy).filter((e): e is [string, string] => typeof e[1] === 'string')
  );
}

export function writeCluePlacement(
  configJson: EditorConfig | null | undefined,
  placement: Record<string, string>
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
    const existingByClueId = new Map(
      readLocationDiscoveries(next, locationId).map((discovery) => [discovery.clueId, discovery])
    );
    next = writeLocationDiscoveries(
      next,
      locationId,
      ids.map(
        (clueId) =>
          existingByClueId.get(clueId) ?? {
            locationId,
            clueId,
            requiredClueIds: [],
            oncePerPlayer: true,
          }
      )
    );
  }
  return next;
}

export function readCharacterStartingClueMap(
  configJson: EditorConfig | null | undefined
): Record<string, string[]> {
  const startingConfig = readModuleConfig(configJson, 'starting_clue');
  if (hasOwnKey(startingConfig, 'startingClues')) {
    return isRecord(startingConfig.startingClues)
      ? Object.fromEntries(
          Object.entries(startingConfig.startingClues).map(([charId, ids]) => [
            charId,
            stringList(ids),
          ])
        )
      : {};
  }

  const source = configJson?.character_clues;
  if (!isRecord(source)) return {};
  return Object.fromEntries(
    Object.entries(source).map(([charId, ids]) => [charId, stringList(ids)])
  );
}

export function writeCharacterStartingClueMap(
  configJson: EditorConfig | null | undefined,
  startingClues: Record<string, string[]>
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

  if (value.clueId === clueId && typeof value.locationId === 'string') return undefined;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key, removeClueIdFromValue(child, clueId)] as const)
      .filter(([, child]) => child !== undefined)
  );
}

export function removeClueReferencesFromConfig(
  configJson: EditorConfig | null | undefined,
  clueId: string
): EditorConfig {
  const normalized = normalizeConfigForSave(configJson);
  return removeClueIdFromValue(normalized, clueId) as EditorConfig;
}
