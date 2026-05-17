import type { LocationResponse } from '@/features/editor/api/types';

export interface LocationHierarchyNode {
  location: LocationResponse;
  depth: 0 | 1;
  children: LocationHierarchyNode[];
  directClueCount: number;
}

export type LocationDropValidation =
  | { ok: true }
  | { ok: false; reason: 'missing-location' | 'self' | 'grandchild' };

export function buildLocationHierarchy(
  locations: LocationResponse[],
  clueCounts: Record<string, number> = {}
): LocationHierarchyNode[] {
  const sorted = [...locations].sort(compareLocations);
  const byId = new Map(sorted.map((location) => [location.id, location]));
  const parentNodes = new Map<string, LocationHierarchyNode>();

  for (const location of sorted) {
    if (!location.parent_location_id || !byId.has(location.parent_location_id)) {
      parentNodes.set(location.id, {
        location,
        depth: 0,
        children: [],
        directClueCount: clueCounts[location.id] ?? 0,
      });
    }
  }

  for (const location of sorted) {
    if (!location.parent_location_id) continue;
    const parent = parentNodes.get(location.parent_location_id);
    if (!parent) continue;
    parent.children.push({
      location,
      depth: 1,
      children: [],
      directClueCount: clueCounts[location.id] ?? 0,
    });
  }

  return Array.from(parentNodes.values());
}

export function getLocationPathLabel(
  location: LocationResponse,
  allLocations: LocationResponse[]
): string {
  const parent = location.parent_location_id
    ? allLocations.find((candidate) => candidate.id === location.parent_location_id)
    : null;
  return parent ? `${parent.name} / ${location.name}` : location.name;
}

export function validateLocationDrop({
  locations,
  draggedId,
  targetParentId,
}: {
  locations: LocationResponse[];
  draggedId: string;
  targetParentId: string | null;
}): LocationDropValidation {
  const dragged = locations.find((location) => location.id === draggedId);
  if (!dragged) return { ok: false, reason: 'missing-location' };
  if (targetParentId === draggedId) return { ok: false, reason: 'self' };
  if (!targetParentId) return { ok: true };

  const targetParent = locations.find((location) => location.id === targetParentId);
  if (!targetParent) return { ok: false, reason: 'missing-location' };
  if (targetParent.parent_location_id) return { ok: false, reason: 'grandchild' };

  return { ok: true };
}

function compareLocations(a: LocationResponse, b: LocationResponse): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, 'ko');
}
