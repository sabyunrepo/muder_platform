import { describe, expect, it } from 'vitest';
import { removeClueReferencesFromConfig } from '../configShape';

describe('removeClueReferencesFromConfig', () => {
  it('removes a deleted clue from location and starting clue settings without removing entities', () => {
    const next = removeClueReferencesFromConfig({
      locations: [
        { id: 'loc-1', name: '서재', locationClueConfig: { clueIds: ['clue-1', 'clue-2'] } },
      ],
      modules: {
        starting_clue: {
          enabled: true,
          config: { startingClues: { 'char-1': ['clue-1', 'clue-3'] } },
        },
      },
    }, 'clue-1');

    expect(next.locations).toEqual([
      { id: 'loc-1', name: '서재', locationClueConfig: { clueIds: ['clue-2'] } },
    ]);
    expect(next.modules).toMatchObject({
      starting_clue: { config: { startingClues: { 'char-1': ['clue-3'] } } },
    });
  });

  it('removes deleted clue ids from nested action and combination settings', () => {
    const next = removeClueReferencesFromConfig({
      modules: {
        clue_action: {
          enabled: true,
          config: {
            rewards: ['clue-1', 'clue-2'],
            fixedTargetClueId: 'clue-1',
          },
        },
        combination: {
          enabled: true,
          config: { recipes: [{ required: ['clue-1', 'clue-3'], output: 'clue-1' }] },
        },
      },
    }, 'clue-1');

    expect(next.modules).toEqual({
      clue_action: { enabled: true, config: { rewards: ['clue-2'] } },
      combination: { enabled: true, config: { recipes: [{ required: ['clue-3'] }] } },
    });
  });
});
