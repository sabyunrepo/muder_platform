# Location Hierarchy Clue Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend UX where creators can manage top-level locations and one-level sub-locations, then place clues directly on either level with persisted payload and reload verification.

**Architecture:** Keep the existing backend contract: `theme_locations.parent_location_id` stores one-level location hierarchy and `theme_clues.location_id` stores the exact parent or child location where a clue belongs. Add frontend-only hierarchy helpers, replace the flat location list with a hierarchy list, preserve `parent_location_id` in save DTOs, and add explicit controls plus native HTML drag/drop for moving and sorting. Do not add a drag/drop dependency unless native events prove insufficient during implementation.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest + Testing Library, existing MMP editor API hooks.

**Seed:** `seed_b82ec88c0653`

---

## File Structure

- Modify `apps/web/src/features/editor/entities/location/locationEntityAdapter.ts`
  - Own pure hierarchy helpers, parent options, path labels, and ViewModel parent fields.
- Create `apps/web/src/features/editor/entities/location/locationHierarchy.ts`
  - Own `buildLocationHierarchy`, drag/drop move validation, and reorder payload helpers.
- Modify `apps/web/src/features/editor/entities/location/__tests__/locationEntityAdapter.test.ts`
  - Cover parent labels and parent options.
- Create `apps/web/src/features/editor/entities/location/__tests__/locationHierarchy.test.ts`
  - Cover tree building, one-level limit, parent/child sorting, and rejected grandchild drops.
- Modify `apps/web/src/features/editor/components/design/LocationsSubTab.tsx`
  - Pass parent-aware creation handlers and current selected map locations into detail/list UI.
- Modify `apps/web/src/features/editor/components/design/LocationDetailPanel.tsx`
  - Replace the flat `EntityEditorShell` list for locations with a custom hierarchy list and add parent selector controls in the detail panel.
- Create `apps/web/src/features/editor/components/design/LocationHierarchyList.tsx`
  - Render parent cards, indented child cards, badges, action buttons, and drag/drop handlers.
- Create `apps/web/src/features/editor/components/design/LocationStructurePanel.tsx`
  - Render parent selection, "move to top level", and "add sub-location" controls.
- Modify `apps/web/src/features/editor/components/design/LocationClueAssignPanel.tsx`
  - Show path labels for location context and preserve exact selected location ID for clue discovery config.
- Modify tests under `apps/web/src/features/editor/components/design/__tests__/`
  - Update `LocationsSubTab.test.tsx`, `LocationClueAssignPanel.test.tsx`, and test utilities for parent/child locations.

## Task 1: Pure Hierarchy Model

**Files:**
- Modify: `apps/web/src/features/editor/entities/location/locationEntityAdapter.ts`
- Create: `apps/web/src/features/editor/entities/location/locationHierarchy.ts`
- Test: `apps/web/src/features/editor/entities/location/__tests__/locationEntityAdapter.test.ts`
- Test: `apps/web/src/features/editor/entities/location/__tests__/locationHierarchy.test.ts`

- [ ] **Step 1: Write failing tests for hierarchy building**

Add `apps/web/src/features/editor/entities/location/__tests__/locationHierarchy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LocationResponse } from '@/features/editor/api';
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

    expect(validateLocationDrop({
      locations,
      draggedId: 'source',
      targetParentId: 'child-1',
    })).toEqual({ ok: false, reason: 'grandchild' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @mmp/web exec vitest run src/features/editor/entities/location/__tests__/locationHierarchy.test.ts
```

Expected: fail because `locationHierarchy.ts` does not exist.

- [ ] **Step 3: Implement hierarchy helpers**

Create `apps/web/src/features/editor/entities/location/locationHierarchy.ts`:

```ts
import type { LocationResponse } from '@/features/editor/api';

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
  clueCounts: Record<string, number> = {},
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

export function getLocationPathLabel(location: LocationResponse, allLocations: LocationResponse[]): string {
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

function compareLocations(a: LocationResponse, b: LocationResponse) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, 'ko');
}
```

- [ ] **Step 4: Implement adapter parent labels and options**

Update `toLocationEditorViewModel` in `locationEntityAdapter.ts`:

```ts
const parent = location.parent_location_id
  ? options.allLocations?.find((candidate) => candidate.id === location.parent_location_id)
  : null;

return {
  ...
  parentLocationId: location.parent_location_id ?? null,
  parentLabel: parent ? parent.name : '최상위 장소',
  ...
};
```

Replace `buildLocationParentOptions` with:

```ts
export function buildLocationParentOptions(
  currentLocationId: string,
  locations: LocationResponse[],
  metaByLocationId: Record<string, LocationMeta | undefined> = {}
): LocationParentOption[] {
  void metaByLocationId;
  return locations
    .filter((location) => location.id !== currentLocationId)
    .filter((location) => !location.parent_location_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko'))
    .map((location) => ({ id: location.id, label: location.name, depth: 0 }));
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @mmp/web exec vitest run src/features/editor/entities/location/__tests__/locationHierarchy.test.ts src/features/editor/entities/location/__tests__/locationEntityAdapter.test.ts
```

Expected: pass.

## Task 2: Hierarchy List UI With Explicit Controls

**Files:**
- Create: `apps/web/src/features/editor/components/design/LocationHierarchyList.tsx`
- Create: `apps/web/src/features/editor/components/design/LocationStructurePanel.tsx`
- Modify: `apps/web/src/features/editor/components/design/LocationDetailPanel.tsx`
- Modify: `apps/web/src/features/editor/components/design/LocationsSubTab.tsx`
- Test: `apps/web/src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests in `LocationsSubTab.test.tsx`:

```ts
it('부모 장소 아래에 하위장소를 들여쓰기 카드로 표시한다', () => {
  useEditorLocationsMock.mockReturnValue({
    data: [
      { ...baseLocation('loc-parent', '호텔 로비'), sort_order: 0, parent_location_id: null },
      { ...baseLocation('loc-child', '프런트 데스크'), sort_order: 0, parent_location_id: 'loc-parent' },
    ],
    isLoading: false,
  });

  renderLocationsSubTab();

  expect(screen.getByRole('button', { name: '호텔 로비 선택' })).toBeDefined();
  expect(screen.getByRole('button', { name: '호텔 로비 / 프런트 데스크 선택' })).toBeDefined();
  expect(screen.getByText('직접 배치 단서 0개 · 하위장소 1개')).toBeDefined();
});

it('부모 카드의 하위장소 추가 버튼은 parent_location_id를 담아 createLocation을 호출한다', () => {
  renderLocationsSubTab();
  fireEvent.click(screen.getByRole('button', { name: '거실 하위장소 추가' }));
  fireEvent.change(screen.getByPlaceholderText('하위장소 이름'), { target: { value: '금고 앞' } });
  fireEvent.keyDown(screen.getByPlaceholderText('하위장소 이름'), { key: 'Enter' });

  expect(mutateMock).toHaveBeenCalledWith(
    { mapId: 'map-1', body: { name: '금고 앞', parent_location_id: 'loc-1' } },
    expect.any(Object),
  );
});
```

If `baseLocation` is not present in the test utility, add it to `locationsSubTabTestData.ts`:

```ts
export function baseLocation(id: string, name: string): LocationResponse {
  return {
    id,
    theme_id: 'theme-1',
    map_id: 'map-1',
    name,
    restricted_characters: null,
    image_url: null,
    image_media_id: null,
    public_description: null,
    entry_message: null,
    parent_location_id: null,
    sort_order: 0,
    created_at: '2026-05-17T00:00:00Z',
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @mmp/web exec vitest run src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx
```

Expected: fail because hierarchy UI does not exist and creates only top-level locations.

- [ ] **Step 3: Create `LocationHierarchyList`**

Implement a focused list component with these props:

```ts
interface LocationHierarchyListProps {
  locations: LocationResponse[];
  theme: EditorThemeResponse;
  selectedId?: string | null;
  onSelect: (locationId: string) => void;
  onDelete: (location: LocationResponse) => void;
  onStartAddTopLevel: () => void;
  onStartAddChild: (parentId: string) => void;
  renderAddChildInput: (parentId: string) => ReactNode;
  onMoveLocation: (locationId: string, parentLocationId: string | null, sortOrder: number) => void;
}
```

Render shape:

```tsx
<section aria-label="장소 목록" className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-3">
  <header>...장소 목록 + 장소 추가...</header>
  {tree.map((node) => (
    <div key={node.location.id} className="space-y-2">
      <LocationCard ariaLabel={`${node.location.name} 선택`} />
      {renderAddChildInput(node.location.id)}
      <div className="ml-5 border-l border-slate-800 pl-3">
        {node.children.map((child) => <LocationCard ariaLabel={`${node.location.name} / ${child.location.name} 선택`} />)}
      </div>
    </div>
  ))}
</section>
```

Use `getLocationPathLabel(child.location, locations)` for child card accessible labels.

- [ ] **Step 4: Create `LocationStructurePanel`**

Implement:

```ts
interface LocationStructurePanelProps {
  location: LocationResponse;
  locations: LocationResponse[];
  onChangeParent: (parentLocationId: string | null) => void;
  onStartAddChild: (parentId: string) => void;
  isSaving: boolean;
}
```

UI requirements:
- Header text: `장소 구조`
- Select label: `상위 장소`
- First option: `최상위 장소`
- Parent options from `buildLocationParentOptions(location.id, locations)`
- If `location.parent_location_id` is set, show button `최상위로 이동`
- If `location.parent_location_id` is null, show button `${location.name} 하위장소 추가`

- [ ] **Step 5: Wire list and structure panel**

In `LocationsSubTab.tsx`, replace the single `addingLocation` boolean with:

```ts
const [addingLocationParentId, setAddingLocationParentId] = useState<string | null | 'top'>(null);
```

Top-level add:

```ts
function handleAddLocation(name: string, parentLocationId: string | null = null) {
  if (!effectiveSelectedMapId) return;
  createLocation.mutate(
    { mapId: effectiveSelectedMapId, body: { name, parent_location_id: parentLocationId } },
    ...
  );
}
```

Pass `onStartAddChild={(parentId) => setAddingLocationParentId(parentId)}` and `onStartAdd={() => setAddingLocationParentId('top')}`.

In `LocationDetailPanel.tsx`, replace `EntityEditorShell` usage for locations with a two-column layout using `LocationHierarchyList` and the existing `SelectedLocationDetail`.

- [ ] **Step 6: Preserve parent in `saveLocation`**

In `SelectedLocationDetail.saveLocation`, replace the hard-coded null:

```ts
parent_location_id: patch.parent_location_id !== undefined
  ? patch.parent_location_id
  : location.parent_location_id ?? null,
```

Call this from `LocationStructurePanel`:

```ts
onChangeParent={(parentLocationId) =>
  saveLocation({ parent_location_id: parentLocationId }, {
    onSuccess: () => toast.success('장소 구조가 저장되었습니다'),
    onErrorMessage: '장소 구조 저장에 실패했습니다',
  })
}
```

- [ ] **Step 7: Run focused UI tests**

Run:

```bash
pnpm --filter @mmp/web exec vitest run src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx
```

Expected: pass.

## Task 3: Native Drag/Drop Move and Sort

**Files:**
- Modify: `apps/web/src/features/editor/entities/location/locationHierarchy.ts`
- Modify: `apps/web/src/features/editor/components/design/LocationHierarchyList.tsx`
- Test: `apps/web/src/features/editor/entities/location/__tests__/locationHierarchy.test.ts`
- Test: `apps/web/src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx`

- [ ] **Step 1: Add failing drag/drop helper tests**

Extend `locationHierarchy.test.ts`:

```ts
import { buildLocationMovePatch } from '../locationHierarchy';

it('builds a patch to move a top-level location under a parent', () => {
  const locations = [
    location({ id: 'parent-1', name: '로비', parent_location_id: null, sort_order: 0 }),
    location({ id: 'source', name: '금고 앞', parent_location_id: null, sort_order: 1 }),
  ];

  expect(buildLocationMovePatch({
    locations,
    draggedId: 'source',
    targetParentId: 'parent-1',
    targetIndex: 0,
  })).toEqual({ parent_location_id: 'parent-1', sort_order: 0 });
});

it('builds a patch to move a child back to top level', () => {
  const locations = [
    location({ id: 'parent-1', name: '로비', parent_location_id: null, sort_order: 0 }),
    location({ id: 'child-1', name: '프런트', parent_location_id: 'parent-1', sort_order: 0 }),
  ];

  expect(buildLocationMovePatch({
    locations,
    draggedId: 'child-1',
    targetParentId: null,
    targetIndex: 1,
  })).toEqual({ parent_location_id: null, sort_order: 1 });
});
```

- [ ] **Step 2: Implement `buildLocationMovePatch`**

Add:

```ts
export interface LocationMovePatch {
  parent_location_id: string | null;
  sort_order: number;
}

export function buildLocationMovePatch({
  locations,
  draggedId,
  targetParentId,
  targetIndex,
}: {
  locations: LocationResponse[];
  draggedId: string;
  targetParentId: string | null;
  targetIndex: number;
}): LocationMovePatch {
  const validation = validateLocationDrop({ locations, draggedId, targetParentId });
  if (!validation.ok) throw new Error(validation.reason);
  return {
    parent_location_id: targetParentId,
    sort_order: Math.max(0, targetIndex),
  };
}
```

- [ ] **Step 3: Add native drag/drop UI**

In `LocationHierarchyList.tsx`:
- Add `draggable` to cards.
- On `dragStart`, store dragged ID in React state.
- Parent card drop zone:
  - `targetParentId = parent.location.id`
  - child index = `parent.children.length`
- Top-level drop zone:
  - `targetParentId = null`
  - target index = `tree.length`
- Child card drop zone:
  - only allow sorting within same parent or moving to top-level drop zone.
- If `validateLocationDrop` returns `grandchild`, show toast `하위장소 아래에는 장소를 넣을 수 없습니다`.

Use accessible labels:

```tsx
<div aria-label={`${location.name} 드래그 영역`} draggable>
```

- [ ] **Step 4: Save drag/drop with existing update hook**

In `LocationDetailPanel.tsx`, expose:

```ts
function moveLocation(locationId: string, parentLocationId: string | null, sortOrder: number) {
  const target = mapLocations.find((candidate) => candidate.id === locationId);
  if (!target) return;
  updateLocation.mutate({
    locationId,
    body: {
      name: target.name,
      restricted_characters: target.restricted_characters,
      image_url: target.image_url,
      public_description: target.public_description ?? null,
      entry_message: target.entry_message ?? null,
      parent_location_id: parentLocationId,
      sort_order: sortOrder,
      appearance_scene_id: target.appearance_scene_id ?? null,
      hide_scene_id: target.hide_scene_id ?? null,
      ...(target.image_media_id !== undefined ? { image_media_id: target.image_media_id ?? null } : {}),
    },
  }, {
    onSuccess: () => toast.success('장소 위치가 저장되었습니다'),
    onError: () => toast.error('장소 위치 저장에 실패했습니다'),
  });
}
```

Pass `moveLocation` to `LocationHierarchyList`.

- [ ] **Step 5: Test drag/drop payload**

Add a test:

```ts
it('드래그앤드롭으로 부모 장소 아래 이동 시 parent_location_id payload를 저장한다', () => {
  renderLocationsSubTab();
  fireEvent.dragStart(screen.getByLabelText('주방 드래그 영역'));
  fireEvent.drop(screen.getByLabelText('거실 하위장소 드롭 영역'));

  expect(mutateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      locationId: 'loc-2',
      body: expect.objectContaining({ parent_location_id: 'loc-1' }),
    }),
    expect.any(Object),
  );
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @mmp/web exec vitest run src/features/editor/entities/location/__tests__/locationHierarchy.test.ts src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx
```

Expected: pass.

## Task 4: Clue Placement Path Labels and Exact Location IDs

**Files:**
- Modify: `apps/web/src/features/editor/components/design/LocationClueAssignPanel.tsx`
- Modify: `apps/web/src/features/editor/components/design/LocationSelectedClueItem.tsx`
- Test: `apps/web/src/features/editor/components/design/__tests__/LocationClueAssignPanel.test.tsx`

- [ ] **Step 1: Add failing clue placement tests**

Add:

```ts
it('하위장소의 경로형 라벨을 헤더에 표시한다', () => {
  const childLocation = {
    ...mockLocation,
    id: 'loc-child',
    name: '프런트 데스크',
    parent_location_id: 'loc-parent',
  };

  renderQC(
    <LocationClueAssignPanel
      themeId="theme-1"
      theme={baseTheme}
      location={childLocation}
      allLocations={[
        { ...mockLocation, id: 'loc-parent', name: '호텔 로비', parent_location_id: null },
        childLocation,
      ]}
    />
  );

  expect(screen.getByText('호텔 로비 / 프런트 데스크 단서 조사')).toBeDefined();
});

it('하위장소에 단서 배치 시 discovery locationId가 하위장소 ID로 저장된다', () => {
  const childLocation = { ...mockLocation, id: 'loc-child', name: '프런트 데스크', parent_location_id: 'loc-parent' };
  renderQC(<LocationClueAssignPanel themeId="theme-1" theme={baseTheme} location={childLocation} />);
  fireEvent.click(screen.getByLabelText('단검 추가'));

  const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
  const modules = config.modules as {
    location: { config: { discoveries: Array<{ locationId: string; clueId: string }> } };
  };
  expect(modules.location.config.discoveries[0]).toMatchObject({
    locationId: 'loc-child',
    clueId: 'clue-1',
  });
});
```

- [ ] **Step 2: Add `allLocations` prop**

Update `LocationClueAssignPanelProps`:

```ts
allLocations?: LocationResponse[];
```

Use:

```ts
const locationLabel = getLocationPathLabel(location, allLocations ?? [location]);
```

Replace header text `${location.name} 단서 조사` with `${locationLabel} 단서 조사`.

- [ ] **Step 3: Pass all map locations**

In `SelectedLocationDetail`, pass:

```tsx
<LocationClueAssignPanel
  themeId={themeId}
  theme={theme}
  location={location}
  allClues={clues}
  allLocations={mapLocations}
/>
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @mmp/web exec vitest run src/features/editor/components/design/__tests__/LocationClueAssignPanel.test.tsx
```

Expected: pass.

## Task 5: End-to-End Reload Restoration Coverage

**Files:**
- Modify: `apps/web/e2e/editor-golden-path.spec.ts` or create `apps/web/e2e/location-hierarchy.spec.ts`
- Modify: `apps/web/e2e/helpers/editor-golden-path-fixtures.ts` only if login/fixture helpers already cover editor setup better there.

- [ ] **Step 1: Create focused E2E test**

Create `apps/web/e2e/location-hierarchy.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { loginAsE2EUser } from './helpers/editor-golden-path-fixtures';

test('장소 하위장소와 단서 배치가 저장 후 새로고침되어 복원된다', async ({ page }) => {
  await loginAsE2EUser(page);
  await page.goto('/editor');

  await page.getByRole('tab', { name: /설계|장소/ }).click();
  await page.getByRole('button', { name: '장소 추가' }).click();
  await page.getByPlaceholder('장소 이름').fill('호텔 로비');
  await page.getByPlaceholder('장소 이름').press('Enter');

  await page.getByRole('button', { name: '호텔 로비 하위장소 추가' }).click();
  await page.getByPlaceholder('하위장소 이름').fill('프런트 데스크');
  await page.getByPlaceholder('하위장소 이름').press('Enter');

  await expect(page.getByRole('button', { name: '호텔 로비 / 프런트 데스크 선택' })).toBeVisible();

  await page.getByRole('button', { name: '호텔 로비 / 프런트 데스크 선택' }).click();
  await page.getByLabel(/단검 추가/).click();

  await page.reload();

  await expect(page.getByRole('button', { name: '호텔 로비 선택' })).toBeVisible();
  await expect(page.getByRole('button', { name: '호텔 로비 / 프런트 데스크 선택' })).toBeVisible();
  await page.getByRole('button', { name: '호텔 로비 / 프런트 데스크 선택' }).click();
  await expect(page.getByLabel(/단검 해제/)).toBeVisible();
});
```

If the existing editor route requires a concrete theme URL, reuse the helper route pattern from `editor-golden-path.spec.ts` and replace `/editor` with that path.

- [ ] **Step 2: Run E2E in headed or normal mode**

Run:

```bash
pnpm --filter @mmp/web exec playwright test e2e/location-hierarchy.spec.ts --project=chromium
```

Expected: pass. If the editor seed theme is unavailable, mark the test with the existing backend availability skip pattern used in nearby live specs instead of skipping unconditionally.

## Task 6: Final Validation and Commit

**Files:**
- All modified frontend files.

- [ ] **Step 1: Run focused Vitest suite**

Run:

```bash
pnpm --filter @mmp/web exec vitest run \
  src/features/editor/entities/location/__tests__/locationHierarchy.test.ts \
  src/features/editor/entities/location/__tests__/locationEntityAdapter.test.ts \
  src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx \
  src/features/editor/components/design/__tests__/LocationClueAssignPanel.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm --filter @mmp/web typecheck
```

Expected: pass.

- [ ] **Step 3: Run E2E**

Run:

```bash
pnpm --filter @mmp/web exec playwright test e2e/location-hierarchy.spec.ts --project=chromium
```

Expected: pass.

- [ ] **Step 4: Browser sanity check**

Start or reuse the current dev server:

```bash
pnpm --filter @mmp/web dev --host 127.0.0.1 --port 3000
```

Open `http://localhost:3000`, log in, and verify:
- `호텔 로비` parent card is visible.
- `프런트 데스크` child card is indented below the parent.
- Parent card and child card both can be selected.
- Parent and child clue assignment panels show path labels.
- Dragging a location under a child location is rejected with an error toast.

- [ ] **Step 5: Commit**

Run:

```bash
git add \
  apps/web/src/features/editor/entities/location/locationEntityAdapter.ts \
  apps/web/src/features/editor/entities/location/locationHierarchy.ts \
  apps/web/src/features/editor/entities/location/__tests__/locationEntityAdapter.test.ts \
  apps/web/src/features/editor/entities/location/__tests__/locationHierarchy.test.ts \
  apps/web/src/features/editor/components/design/LocationsSubTab.tsx \
  apps/web/src/features/editor/components/design/LocationDetailPanel.tsx \
  apps/web/src/features/editor/components/design/LocationHierarchyList.tsx \
  apps/web/src/features/editor/components/design/LocationStructurePanel.tsx \
  apps/web/src/features/editor/components/design/LocationClueAssignPanel.tsx \
  apps/web/src/features/editor/components/design/LocationSelectedClueItem.tsx \
  apps/web/src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx \
  apps/web/src/features/editor/components/design/__tests__/LocationClueAssignPanel.test.tsx \
  apps/web/e2e/location-hierarchy.spec.ts
git commit -m "feat: add location hierarchy clue placement UI"
```

## Self-Review

- Spec coverage: all Seed acceptance criteria map to Tasks 1-5. One-level depth is covered by pure helper tests and drag/drop rejection tests. Payload persistence is covered by component tests and E2E reload.
- Placeholder scan: no placeholder markers or unspecified test step remains.
- Type consistency: use existing `LocationResponse.parent_location_id`, `CreateLocationRequest.parent_location_id`, and `UpdateLocationRequest.parent_location_id`; no backend contract changes required.
