import { describe, expect, it } from 'vitest';
import type { LocationResponse } from '@/features/editor/api/types';
import {
  buildLocationHierarchy,
  buildLocationMovePatch,
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

  it('keeps direct clue counts separate for parents and children', () => {
    const tree = buildLocationHierarchy(
      [
        location({ id: 'parent-1', name: '로비', parent_location_id: null, sort_order: 1 }),
        location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1', sort_order: 1 }),
      ],
      {
        'parent-1': 2,
        'child-1': 3,
      }
    );

    expect(tree[0].directClueCount).toBe(2);
    expect(tree[0].children[0].directClueCount).toBe(3);
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

  it('rejects moving a parent that already owns children under another parent', () => {
    const locations = [
      location({ id: 'parent-1', name: '로비', parent_location_id: null }),
      location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1' }),
      location({ id: 'parent-2', name: '객실', parent_location_id: null }),
    ];

    expect(
      validateLocationDrop({
        locations,
        draggedId: 'parent-1',
        targetParentId: 'parent-2',
      })
    ).toEqual({ ok: false, reason: 'child-parent' });
  });

  it('builds a patch to move a top-level location under a parent', () => {
    const locations = [
      location({ id: 'parent-1', name: '로비', parent_location_id: null, sort_order: 0 }),
      location({ id: 'source', name: '금고 앞', parent_location_id: null, sort_order: 1 }),
    ];

    expect(
      buildLocationMovePatch({
        locations,
        draggedId: 'source',
        targetParentId: 'parent-1',
        targetIndex: 0,
      })
    ).toEqual({ parent_location_id: 'parent-1', sort_order: 0 });
  });

  it('builds a patch to move a child back to top level', () => {
    const locations = [
      location({ id: 'parent-1', name: '로비', parent_location_id: null, sort_order: 0 }),
      location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1', sort_order: 0 }),
    ];

    expect(
      buildLocationMovePatch({
        locations,
        draggedId: 'child-1',
        targetParentId: null,
        targetIndex: 1,
      })
    ).toEqual({ parent_location_id: null, sort_order: 1 });
  });
});
