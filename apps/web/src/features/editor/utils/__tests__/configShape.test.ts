import { describe, expect, it } from 'vitest';
import {
  normalizeConfigForSave,
  readClueItemEffect,
  readClueItemEffects,
  readCharacterStartingClueMap,
  readCluePlacement,
  readEnabledModuleIds,
  readLocationClueIds,
  readModuleConfig,
  writeCharacterStartingClueMap,
  writeClueItemEffect,
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

  it('reads valid clue runtime effects from the clue interaction module only', () => {
    const config = {
      itemEffects: {
        'root-decoy': { effect: 'reveal', revealText: '잘못된 위치' },
      },
      modules: {
        timer: {
          enabled: true,
          config: {
            itemEffects: {
              'timer-decoy': { effect: 'reveal', revealText: '다른 모듈' },
            },
          },
        },
        clue_interaction: {
          enabled: true,
          config: {
            itemEffects: {
              'clue-1': {
                effect: 'reveal',
                target: 'self',
                revealText: '숫자 0427이 보입니다.',
                consume: true,
              },
              'clue-2': { effect: 'unknown', revealText: '무시' },
            },
          },
        },
      },
    };

    const effects = readClueItemEffects(config);
    expect(effects).toEqual({
      'clue-1': {
        effect: 'reveal',
        target: 'self',
        revealText: '숫자 0427이 보입니다.',
        consume: true,
      },
    });
    expect(effects).not.toHaveProperty('root-decoy');
    expect(effects).not.toHaveProperty('timer-decoy');
    expect(readClueItemEffect(config, 'root-decoy')).toBeNull();
    expect(readClueItemEffect(config, 'timer-decoy')).toBeNull();
    expect(readClueItemEffect(config, 'clue-2')).toBeNull();
  });

  it('writes and removes clue runtime effects while preserving module settings', () => {
    const base = {
      modules: {
        clue_interaction: {
          enabled: true,
          config: {
            cooldownSec: 5,
            itemEffects: {
              'future-clue': { effect: 'future_effect', custom: true },
              'clue-1': { effect: 'reveal', legacyNote: 'preserve me', grantClueIds: ['old'] },
            },
          },
        },
      },
    };

    const withEffect = writeClueItemEffect(base, 'clue-1', {
      effect: 'grant_clue',
      target: 'self',
      grantClueIds: ['clue-2', 'clue-3'],
      consume: true,
    });

    expect(readClueItemEffect(withEffect, 'clue-1')).toEqual({
      effect: 'grant_clue',
      target: 'self',
      grantClueIds: ['clue-2', 'clue-3'],
      consume: true,
      legacyNote: 'preserve me',
    });
    expect(readModuleConfig(withEffect, 'clue_interaction')).toMatchObject({
      cooldownSec: 5,
      itemEffects: {
        'future-clue': { effect: 'future_effect', custom: true },
      },
    });

    const removed = writeClueItemEffect(withEffect, 'clue-1', null);
    expect(readClueItemEffect(removed, 'clue-1')).toBeNull();
    expect(readModuleConfig(removed, 'clue_interaction')).toEqual({
      cooldownSec: 5,
      itemEffects: {
        'future-clue': { effect: 'future_effect', custom: true },
      },
    });
  });

  it('does not create clue interaction config when deleting a missing runtime effect', () => {
    const base = { modules: { timer: { enabled: true, config: { seconds: 30 } } } };

    const next = writeClueItemEffect(base, 'missing-clue', null);

    expect(next).toBe(base);
    expect(readClueItemEffect(next, 'missing-clue')).toBeNull();
    expect(readModuleConfig(next, 'clue_interaction')).toEqual({});
    expect(readModuleConfig(next, 'timer')).toEqual({ seconds: 30 });
  });
});
