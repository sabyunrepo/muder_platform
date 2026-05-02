import { describe, it, expect } from 'vitest';
import { validateGameDesign } from '../validation';

describe('validateGameDesign', () => {
  const fullConfig = {
    phases: [{ id: 'p1', name: '페이즈 1' }],
    modules: {
      clue_board: { enabled: true },
      voting: { enabled: true },
      starting_clue: {
        enabled: true,
        config: { startingClues: { char1: ['clue1'], char2: ['clue2'] } },
      },
    },
    locations: [
      { id: 'loc1', locationClueConfig: { clueIds: ['clue1'] } },
      { id: 'loc2', locationClueConfig: { clueIds: ['clue2'] } },
    ],
    character_missions: {},
  };

  it('모든 항목이 완료되면 빈 배열 반환', () => {
    const result = validateGameDesign(fullConfig, 2, 2);
    expect(result).toHaveLength(0);
  });

  it('phases가 없으면 error 반환', () => {
    const config = { ...fullConfig, phases: [] };
    const result = validateGameDesign(config, 2, 2);
    const err = result.find((w) => w.category === 'phases');
    expect(err).toBeDefined();
    expect(err?.type).toBe('error');
    expect(err?.message).toBe('페이즈가 설정되지 않았습니다');
  });

  it('phases 키가 없으면 error 반환', () => {
    const { phases: _phases, ...config } = fullConfig;
    const result = validateGameDesign(config, 0, 0);
    const err = result.find((w) => w.category === 'phases');
    expect(err?.type).toBe('error');
  });

  it('modules가 없으면 error 반환', () => {
    const config = { ...fullConfig, modules: {} };
    const result = validateGameDesign(config, 0, 0);
    const err = result.find((w) => w.category === 'modules');
    expect(err).toBeDefined();
    expect(err?.type).toBe('error');
    expect(err?.message).toBe('활성 모듈이 없습니다');
  });

  it('미배치 단서가 있으면 warning 반환', () => {
    const config = { ...fullConfig, locations: [{ id: 'loc1', locationClueConfig: { clueIds: ['clue1'] } }] };
    // 3 clues total, 1 placed → 2 unplaced
    const result = validateGameDesign(config, 3, 2);
    const warn = result.find((w) => w.category === 'clues');
    expect(warn).toBeDefined();
    expect(warn?.type).toBe('warning');
    expect(warn?.message).toBe('2개 단서가 장소에 배치되지 않았습니다');
  });

  it('locations 배치가 없으면 전체 미배치로 warning 반환', () => {
    const config = { ...fullConfig, locations: [] };
    const result = validateGameDesign(config, 2, 0);
    const warn = result.find((w) => w.category === 'clues');
    expect(warn?.message).toBe('2개 단서가 장소에 배치되지 않았습니다');
  });

  it('미배정 캐릭터가 있으면 warning 반환', () => {
    const config = {
      ...fullConfig,
      modules: { starting_clue: { enabled: true, config: { startingClues: { char1: ['clue1'] } } } },
    };
    // 3 characters total, 1 assigned → 2 unassigned
    const result = validateGameDesign(config, 2, 3);
    const warn = result.find((w) => w.category === 'characters');
    expect(warn).toBeDefined();
    expect(warn?.type).toBe('warning');
    expect(warn?.message).toBe('2명의 캐릭터에 시작 단서가 배정되지 않았습니다');
  });

  it('starting_clue 설정이 없으면 전체 미배정으로 warning 반환', () => {
    const config = { ...fullConfig, modules: { clue_board: { enabled: true } } };
    const result = validateGameDesign(config, 0, 2);
    const warn = result.find((w) => w.category === 'characters');
    expect(warn?.message).toBe('2명의 캐릭터에 시작 단서가 배정되지 않았습니다');
  });

  it('clueCount=0이면 clue warning 없음', () => {
    const config = { ...fullConfig, locations: [] };
    const result = validateGameDesign(config, 0, 2);
    expect(result.find((w) => w.category === 'clues')).toBeUndefined();
  });

  it('characterCount=0이면 character warning 없음', () => {
    const config = { ...fullConfig, modules: { clue_board: { enabled: true } } };
    const result = validateGameDesign(config, 2, 0);
    expect(result.find((w) => w.category === 'characters')).toBeUndefined();
  });
});
