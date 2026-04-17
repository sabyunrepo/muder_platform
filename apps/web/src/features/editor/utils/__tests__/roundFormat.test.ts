import { describe, it, expect } from 'vitest';
import { formatRoundRange } from '../roundFormat';

describe('formatRoundRange', () => {
  it('returns null when both bounds are absent', () => {
    expect(formatRoundRange(null, null)).toBeNull();
    expect(formatRoundRange(undefined, undefined)).toBeNull();
    expect(formatRoundRange(null, undefined)).toBeNull();
  });

  it('formats open lower bound (reveal only / from only)', () => {
    expect(formatRoundRange(2, null)).toBe('R2~');
    expect(formatRoundRange(5, undefined)).toBe('R5~');
  });

  it('formats open upper bound (hide only / until only)', () => {
    expect(formatRoundRange(null, 4)).toBe('~R4');
    expect(formatRoundRange(undefined, 7)).toBe('~R7');
  });

  it('formats closed range', () => {
    expect(formatRoundRange(2, 5)).toBe('R2~5');
    expect(formatRoundRange(1, 10)).toBe('R1~10');
  });

  it('collapses single-round range', () => {
    expect(formatRoundRange(3, 3)).toBe('R3');
  });
});
