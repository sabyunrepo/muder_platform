import { describe, expect, it } from 'vitest';
import type {
  ClueResponse,
  EditorCharacterResponse,
  LocationResponse,
} from '@/features/editor/api';
import { buildClueUsageMap, getClueBacklinks } from '../entityReferences';

const clues = [
  { id: 'clue-1', name: '일기장' },
  { id: 'clue-2', name: '피 묻은 칼' },
  { id: 'clue-3', name: '담배꽁초' },
] as ClueResponse[];

const locations = [
  { id: 'loc-1', name: '서재' },
  { id: 'loc-2', name: '부엌' },
] as LocationResponse[];

const characters = [{ id: 'char-1', name: '김철수' }] as EditorCharacterResponse[];

describe('entityReferences', () => {
  it('builds clue backlinks from location clue, evidence, and starting clue references', () => {
    const usage = buildClueUsageMap({
      clues,
      locations,
      characters,
      configJson: {
        locations: [
          {
            id: 'loc-1',
            locationClueConfig: { clueIds: ['clue-1'] },
            evidenceConfig: { clueIds: ['clue-2'] },
          },
        ],
        modules: {
          starting_clue: {
            enabled: true,
            config: { startingClues: { 'char-1': ['clue-1'] } },
          },
          event_progression: {
            enabled: true,
            config: {
              Triggers: [
                {
                  id: 'trigger-clue-2',
                  placement: { kind: 'clue', entityId: 'clue-2' },
                  actions: [{ type: 'OPEN_VOTING' }],
                },
              ],
            },
          },
        },
      },
    });

    expect(getClueBacklinks(usage, 'clue-1')).toEqual([
      { sourceType: 'location', sourceId: 'loc-1', sourceName: '서재', relation: 'location_clue' },
      {
        sourceType: 'character',
        sourceId: 'char-1',
        sourceName: '김철수',
        relation: 'starting_clue',
      },
    ]);
    expect(getClueBacklinks(usage, 'clue-2')).toEqual([
      { sourceType: 'location', sourceId: 'loc-1', sourceName: '서재', relation: 'evidence' },
      { sourceType: 'clue', sourceId: 'clue-2', sourceName: '피 묻은 칼', relation: 'trigger' },
    ]);
    expect(usage['clue-3'].isUnused).toBe(true);
  });

  it('ignores references to deleted clues', () => {
    const usage = buildClueUsageMap({
      clues,
      locations,
      characters,
      configJson: {
        locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['missing-clue'] } }],
        modules: {
          starting_clue: {
            enabled: true,
            config: { startingClues: { 'char-1': ['missing-clue'] } },
          },
        },
      },
    });

    expect(Object.values(usage).every((summary) => summary.references.length === 0)).toBe(true);
  });
});
