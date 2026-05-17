import { describe, expect, it } from 'vitest';
import type { LocationResponse } from '@/features/editor/api/types';
import {
  buildLocationHierarchy,
  getLocationPathLabel,
  validateLocationDrop,
} from '../locationHierarchy';

function location(partial: Partial<LocationResponse> & { id: string; name: string }): LocationResponse {
  return {
    theme_id: 'theme-1',
    map_id: 'map-1',
    restricted_characters: null,
    image_url: null,
    sort_order: 0,
    created_at: '2026-05-17T00:00:00Z',
    ...partial,
  };
}

describe('locationHierarchy', () => {
  it('builds top-level parents with one-level children sorted by sort_order', () => {
    const tree = buildLocationHierarchy([
      location({ id: 'child-2', name: '금고', parent_location_id: 'parent-1', sort_order: 2 }),
      location({ id: 'parent-1', name: '로비', parent_location_id: null, sort_order: 1 }),
      location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1', sort_order: 1 }),
      location({ id: 'parent-2', name: '객실', parent_location_id: null, sort_order: 2 }),
    ]);

    expect(tree.map((node) => node.location.id)).toEqual(['parent-1', 'parent-2']);
    expect(tree[0].children.map((node) => node.location.id)).toEqual(['child-1', 'child-2']);
  });

  it('formats child path labels as parent slash child', () => {
    const locations = [
      location({ id: 'parent-1', name: '로비', parent_location_id: null }),
      location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1' }),
    ];

    expect(getLocationPathLabel(locations[0], locations)).toBe('로비');
    expect(getLocationPathLabel(locations[1], locations)).toBe('로비 / 프런트');
  });

  it('rejects drops that would create a grandchild', () => {
    const locations = [
      location({ id: 'parent-1', name: '로비', parent_location_id: null }),
      location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1' }),
      location({ id: 'source', name: '영수증', parent_location_id: null }),
    ];

    expect(
      validateLocationDrop({
        locations,
        draggedId: 'source',
        targetParentId: 'child-1',
      })
    ).toEqual({ ok: false, reason: 'grandchild' });
  });
});
