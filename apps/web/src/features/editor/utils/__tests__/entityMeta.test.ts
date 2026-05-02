import { describe, expect, it } from 'vitest';
import {
  formatRestrictedCharacterIds,
  parseRestrictedCharacterIds,
  readLocationMeta,
  writeLocationMeta,
} from '../entityMeta';

describe('entityMeta', () => {
  it('reads and writes location meta without legacy config keys', () => {
    const next = writeLocationMeta(
      { clue_placement: { old: 'loc-1' }, locationMeta: { 'loc-1': { entryMessage: 'old' } } },
      'loc-1',
      { parentLocationId: 'parent-1', entryMessage: '문이 삐걱인다.', imageUrl: 'study.jpg' },
    );

    expect(next).not.toHaveProperty('clue_placement');
    expect(readLocationMeta(next, 'loc-1')).toEqual({
      parentLocationId: 'parent-1',
      entryMessage: '문이 삐걱인다.',
      imageUrl: 'study.jpg',
    });
  });

  it('does not allow a location to be its own parent', () => {
    const next = writeLocationMeta({}, 'loc-1', { parentLocationId: 'loc-1' });

    expect(readLocationMeta(next, 'loc-1')).not.toHaveProperty('parentLocationId');
  });

  it('parses and formats restricted character CSV values', () => {
    expect(parseRestrictedCharacterIds(' char-1, char-2,,char-1 ')).toEqual([
      'char-1',
      'char-2',
      'char-1',
    ]);
    expect(formatRestrictedCharacterIds(['char-1', 'char-2', 'char-1', ''])).toBe('char-1,char-2');
    expect(formatRestrictedCharacterIds([])).toBeNull();
  });
});
