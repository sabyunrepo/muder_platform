import { describe, expect, it } from 'vitest';
import {
  normalizeConfigForSave,
  readCharacterStartingClueMap,
  readCluePlacement,
  readEnabledModuleIds,
  readLocationClueIds,
  readModuleConfig,
  writeCharacterStartingClueMap,
  writeCluePlacement,
  writeLocationClueIds,
  writeModuleConfig,
  writeModuleConfigPath,
  writeModuleEnabled,
} from '../configShape';

describe('configShape', () => {
  it('reads legacy modules but writes canonical module map', () => {
    const legacy = {
      modules: ['timer'],
      module_configs: { timer: { seconds: 60 } },
    };

    expect(readEnabledModuleIds(legacy)).toEqual(['timer']);
    expect(readModuleConfig(legacy, 'timer')).toEqual({ seconds: 60 });

    const next = writeModuleEnabled(legacy, 'redaction', true);
    expect(next).toMatchObject({
      modules: {
        timer: { enabled: true, config: { seconds: 60 } },
        redaction: { enabled: true },
      },
    });
    expect(next).not.toHaveProperty('module_configs');
  });

  it('updates nested module config without legacy module_configs', () => {
    const next = writeModuleConfig({ modules: { timer: { enabled: true } } }, 'timer', {
      seconds: 30,
    });

    expect(next).toEqual({ modules: { timer: { enabled: true, config: { seconds: 30 } } } });
  });

  it('updates dotted module config paths as nested objects', () => {
    const next = writeModuleConfigPath(
      {
        modules: {
          voting: {
            enabled: true,
            config: { candidatePolicy: { includeSelf: false }, maxRounds: 3 },
          },
        },
      },
      'voting',
      'candidatePolicy.includeDetective',
      true,
    );

    expect(readModuleConfig(next, 'voting')).toEqual({
      candidatePolicy: { includeSelf: false, includeDetective: true },
      maxRounds: 3,
    });
    expect(next).not.toHaveProperty('module_configs');
  });

  it('normalizes location clueIds into locationClueConfig', () => {
    const next = normalizeConfigForSave({
      locations: [{ id: 'loc-1', clueIds: ['clue-1'] }],
    });

    expect(readLocationClueIds(next, 'loc-1')).toEqual(['clue-1']);
    expect(next).toEqual({
      modules: {},
      locations: [{ id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } }],
    });
  });

  it('keeps empty canonical location clueIds instead of reviving legacy placement', () => {
    const config = {
      clue_placement: { 'legacy-clue': 'loc-1' },
      locations: [{ id: 'loc-1', locationClueConfig: { clueIds: [] } }],
    };

    expect(readLocationClueIds(config, 'loc-1')).toEqual([]);
    expect(readCluePlacement(config)).toEqual({});

    const next = normalizeConfigForSave(config);
    expect(next).not.toHaveProperty('clue_placement');
    expect(next.locations).toEqual([
      { id: 'loc-1', locationClueConfig: { clueIds: [] } },
    ]);
  });

  it('writes clue placement through locations[].locationClueConfig', () => {
    const next = writeCluePlacement(
      { clue_placement: { old: 'legacy' }, locations: [{ id: 'loc-1' }] },
      { 'clue-1': 'loc-1', 'clue-2': 'loc-1' },
    );

    expect(readCluePlacement(next)).toEqual({ 'clue-1': 'loc-1', 'clue-2': 'loc-1' });
    expect(next).not.toHaveProperty('clue_placement');
    expect(next.locations).toEqual([
      { id: 'loc-1', locationClueConfig: { clueIds: ['clue-1', 'clue-2'] } },
    ]);
  });

  it('writes one location assignment without locations[].clueIds', () => {
    const next = writeLocationClueIds(
      { locations: [{ id: 'loc-1', clueIds: ['old'] }] },
      'loc-1',
      ['clue-1'],
    );

    expect(readLocationClueIds(next, 'loc-1')).toEqual(['clue-1']);
    expect(next.locations).toEqual([
      { id: 'loc-1', locationClueConfig: { clueIds: ['clue-1'] } },
    ]);
  });

  it('reads legacy character clues and writes starting_clue module config', () => {
    const legacy = { character_clues: { char1: ['clue1'] } };
    expect(readCharacterStartingClueMap(legacy)).toEqual({ char1: ['clue1'] });

    const next = writeCharacterStartingClueMap(legacy, { char1: ['clue2'] });
    expect(next).toEqual({
      modules: {
        starting_clue: {
          enabled: true,
          config: { startingClues: { char1: ['clue2'] } },
        },
      },
    });
  });

  it('keeps empty canonical starting clues instead of reviving legacy character_clues', () => {
    const config = {
      character_clues: { char1: ['legacy-clue'] },
      modules: {
        starting_clue: {
          enabled: true,
          config: { startingClues: {} },
        },
      },
    };

    expect(readCharacterStartingClueMap(config)).toEqual({});
  });
});
