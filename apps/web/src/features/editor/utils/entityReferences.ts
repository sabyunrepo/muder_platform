import type {
  ClueResponse,
  EditorCharacterResponse,
  LocationResponse,
} from '@/features/editor/api';
import {
  readCharacterStartingClueMap,
  readLocationsConfig,
  readLocationClueIds,
  type EditorConfig,
} from './configShape';
import { readEventProgressionTriggers } from './eventProgressionConfig';

export type EntityReferenceSource = 'location' | 'character' | 'clue' | 'question';
export type EntityReferenceRelation =
  | 'evidence'
  | 'location_clue'
  | 'starting_clue'
  | 'combination_input'
  | 'combination_output'
  | 'trigger'
  | 'question_choice';

export interface EntityReference {
  sourceType: EntityReferenceSource;
  sourceId: string;
  sourceName: string;
  relation: EntityReferenceRelation;
}

export interface ClueUsageSummary {
  clueId: string;
  references: EntityReference[];
  isUnused: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function pushUnique(target: EntityReference[], ref: EntityReference) {
  const key = `${ref.sourceType}:${ref.sourceId}:${ref.relation}`;
  if (!target.some((item) => `${item.sourceType}:${item.sourceId}:${item.relation}` === key)) {
    target.push(ref);
  }
}

function readEvidenceClueIds(locationConfig: Record<string, unknown>): string[] {
  const evidence = locationConfig.evidenceConfig;
  return isRecord(evidence) ? stringList(evidence.clueIds) : [];
}

export function buildClueUsageMap(params: {
  configJson: EditorConfig | null | undefined;
  clues: ClueResponse[];
  locations: LocationResponse[];
  characters: EditorCharacterResponse[];
}): Record<string, ClueUsageSummary> {
  const { configJson, clues, locations, characters } = params;
  const clueIds = new Set(clues.map((clue) => clue.id));
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const characterNames = new Map(characters.map((character) => [character.id, character.name]));
  const triggerClueIds = new Set(
    readEventProgressionTriggers(configJson)
      .filter((trigger) => trigger.placement?.kind === 'clue')
      .map((trigger) => trigger.placement?.entityId)
      .filter((id): id is string => typeof id === 'string' && clueIds.has(id))
  );
  const usage = Object.fromEntries(
    clues.map((clue) => [clue.id, { clueId: clue.id, references: [], isUnused: true }])
  ) as Record<string, ClueUsageSummary>;

  for (const location of readLocationsConfig(configJson)) {
    const sourceName = locationNames.get(location.id) ?? location.name ?? location.id;
    for (const clueId of readLocationClueIds(configJson, location.id)) {
      if (!clueIds.has(clueId)) continue;
      pushUnique(usage[clueId].references, {
        sourceType: 'location',
        sourceId: location.id,
        sourceName,
        relation: 'location_clue',
      });
    }
    for (const clueId of readEvidenceClueIds(location)) {
      if (!clueIds.has(clueId)) continue;
      pushUnique(usage[clueId].references, {
        sourceType: 'location',
        sourceId: location.id,
        sourceName,
        relation: 'evidence',
      });
    }
  }

  for (const [characterId, assignedClueIds] of Object.entries(
    readCharacterStartingClueMap(configJson)
  )) {
    const sourceName = characterNames.get(characterId) ?? characterId;
    for (const clueId of assignedClueIds) {
      if (!clueIds.has(clueId)) continue;
      pushUnique(usage[clueId].references, {
        sourceType: 'character',
        sourceId: characterId,
        sourceName,
        relation: 'starting_clue',
      });
    }
  }

  for (const clue of clues) {
    if (!triggerClueIds.has(clue.id)) continue;
    pushUnique(usage[clue.id].references, {
      sourceType: 'clue',
      sourceId: clue.id,
      sourceName: clue.name,
      relation: 'trigger',
    });
  }

  for (const summary of Object.values(usage)) {
    summary.isUnused = summary.references.length === 0;
  }

  return usage;
}

export function getClueBacklinks(
  usageMap: Record<string, ClueUsageSummary>,
  clueId: string
): EntityReference[] {
  return usageMap[clueId]?.references ?? [];
}
