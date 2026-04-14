import { describe, it, expect } from 'vitest';
import { validateClueGraph } from '../validation';

const clues = [
  { id: 'c1', name: '단서1' },
  { id: 'c2', name: '단서2' },
  { id: 'c3', name: '단서3' },
];

describe('validateClueGraph', () => {
  it('빈 관계 → 빈 배열 반환', () => {
    const result = validateClueGraph([], clues);
    expect(result).toHaveLength(0);
  });

  it('정상 그래프 → 빈 배열 반환', () => {
    const relations = [
      { sourceId: 'c1', targetId: 'c2', mode: 'requires' },
      { sourceId: 'c2', targetId: 'c3', mode: 'requires' },
    ];
    const result = validateClueGraph(relations, clues);
    expect(result).toHaveLength(0);
  });

  it('self-reference → error 반환', () => {
    const relations = [{ sourceId: 'c1', targetId: 'c1', mode: 'requires' }];
    const result = validateClueGraph(relations, clues);
    const err = result.find((w) => w.type === 'error' && w.category === 'clue_graph');
    expect(err).toBeDefined();
    expect(err?.message).toContain('자기 자신');
    expect(err?.message).toContain('단서1');
  });

  it('self-reference — 알 수 없는 id → sourceId로 폴백', () => {
    const relations = [{ sourceId: 'unknown', targetId: 'unknown', mode: 'requires' }];
    const result = validateClueGraph(relations, []);
    const err = result.find((w) => w.type === 'error');
    expect(err?.message).toContain('unknown');
  });

  it('cycle 감지 → error 반환', () => {
    const relations = [
      { sourceId: 'c1', targetId: 'c2', mode: 'requires' },
      { sourceId: 'c2', targetId: 'c3', mode: 'requires' },
      { sourceId: 'c3', targetId: 'c1', mode: 'requires' },
    ];
    const result = validateClueGraph(relations, clues);
    const err = result.find((w) => w.type === 'error' && w.category === 'clue_graph');
    expect(err).toBeDefined();
    expect(err?.message).toContain('순환 참조');
  });

  it('관계가 없으면 orphan warning 없음', () => {
    const result = validateClueGraph([], clues);
    expect(result.find((w) => w.type === 'warning')).toBeUndefined();
  });

  it('일부 단서가 관계에 미포함 → warning 반환', () => {
    const relations = [{ sourceId: 'c1', targetId: 'c2', mode: 'requires' }];
    const result = validateClueGraph(relations, clues);
    const warn = result.find((w) => w.type === 'warning' && w.category === 'clue_graph');
    expect(warn).toBeDefined();
    expect(warn?.message).toContain('1개 단서');
  });

  it('모든 단서가 orphan이면 warning 없음 (전체 미연결)', () => {
    const isolated = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    // relations only touch 'a' and 'b', so no orphans
    const relations = [{ sourceId: 'a', targetId: 'b', mode: 'requires' }];
    const result = validateClueGraph(relations, isolated);
    expect(result.find((w) => w.type === 'warning')).toBeUndefined();
  });

  it('모든 단서가 관계에 포함 → orphan warning 없음', () => {
    const relations = [
      { sourceId: 'c1', targetId: 'c2', mode: 'requires' },
      { sourceId: 'c2', targetId: 'c3', mode: 'requires' },
    ];
    const result = validateClueGraph(relations, clues);
    expect(result.find((w) => w.type === 'warning')).toBeUndefined();
  });
});
