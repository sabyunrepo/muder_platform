# Player Kill Clue Effect Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `player_kill` 모듈이 꺼져 있으면 단서관리의 `살해 요청` 효과 선택지를 숨기고, 다시 켜면 선택지가 다시 보이게 한다.

**Architecture:** `configJson.modules.player_kill.enabled`는 이미 캐릭터 상세에서 `살해 가능` 표시 조건으로 쓰인다. 같은 파생값을 단서 상세 컨테이너인 `ClueEntityWorkspace`에서 계산해 `ClueRuntimeEffectCard`에 전달하고, 카드 컴포넌트는 해당 prop으로 kill 효과 버튼과 확률 입력 표시만 제어한다. 저장된 kill 효과 데이터는 모듈 off 시 삭제하지 않아, 모듈을 다시 켰을 때 기존 제작 설정을 복구할 수 있게 둔다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, MMP editor config helpers.

---

### Task 1: Regression Tests

**Files:**
- Modify: `apps/web/src/features/editor/components/clues/ClueRuntimeEffectCard.test.tsx`
- Modify: `apps/web/src/features/editor/components/clues/ClueEntityWorkspace.test.tsx`

- [x] **Step 1: Write failing component tests**

Add two assertions to `ClueRuntimeEffectCard.test.tsx`: one for `isPlayerKillEnabled={false}` hiding kill UI, one for `true` preserving the existing kill flow.

```tsx
it('플레이어킬 모듈이 꺼져 있으면 살해 요청 효과를 숨긴다', () => {
  render(
    <ClueRuntimeEffectCard
      clue={clues[0]}
      clues={clues}
      configJson={{}}
      isPlayerKillEnabled={false}
    />,
  );

  fireEvent.click(screen.getByLabelText('사용 가능한 아이템'));

  expect(screen.queryByRole('button', { name: '살해 요청' })).toBeNull();
  expect(screen.queryByLabelText('살해확률 (%)')).toBeNull();
});
```

Update the existing kill-save test render call to include:

```tsx
isPlayerKillEnabled={true}
```

Add an integration-level assertion to `ClueEntityWorkspace.test.tsx` so the workspace proves it derives the flag from config:

```tsx
it('플레이어킬 모듈 상태에 따라 살해 요청 효과를 숨기거나 보여준다', () => {
  const baseProps = {
    themeId: 'theme-1',
    clues: [clue({ id: 'clue-1' })],
    flowNodes,
    locations: [],
    characters: [],
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
  };

  const { rerender } = render(
    <ClueEntityWorkspace
      {...baseProps}
      configJson={{ modules: { player_kill: { enabled: false, config: {} } } }}
    />,
  );
  fireEvent.click(screen.getByLabelText('사용 가능한 아이템'));
  expect(screen.queryByRole('button', { name: '살해 요청' })).toBeNull();

  rerender(
    <ClueEntityWorkspace
      {...baseProps}
      configJson={{ modules: { player_kill: { enabled: true, config: {} } } }}
    />,
  );
  fireEvent.click(screen.getByLabelText('사용 가능한 아이템'));
  expect(screen.getByRole('button', { name: '살해 요청' })).toBeDefined();
});
```

- [x] **Step 2: Run RED verification**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/components/clues/ClueRuntimeEffectCard.test.tsx src/features/editor/components/clues/ClueEntityWorkspace.test.tsx
```

Expected: FAIL because `ClueRuntimeEffectCardProps` does not yet define `isPlayerKillEnabled`, and/or `살해 요청` is still visible when the module is disabled.

### Task 2: Visibility Wiring

**Files:**
- Modify: `apps/web/src/features/editor/components/clues/ClueRuntimeEffectCard.tsx`
- Modify: `apps/web/src/features/editor/components/clues/ClueEntityWorkspace.tsx`

- [x] **Step 1: Add a prop to the runtime effect card**

In `ClueRuntimeEffectCardProps`, add:

```ts
isPlayerKillEnabled: boolean;
```

In the component parameter list, read the prop:

```ts
isPlayerKillEnabled,
```

Render the kill option only when enabled:

```tsx
{isPlayerKillEnabled && (
  <EffectChoice mode="kill" current={draft.mode} label="살해 요청" icon={<TriangleAlert className="h-4 w-4" />} onSelect={() => updateDraft({ mode: 'kill' })} />
)}
```

Guard the kill detail block with `draft.mode === 'kill' && isPlayerKillEnabled`. Existing saved kill data can still hydrate the draft internally, but the creator cannot see or edit kill-specific controls while the module is off.

- [x] **Step 2: Derive player kill status in the workspace**

In `ClueEntityWorkspace.tsx`, import:

```ts
readEnabledModuleIds,
PLAYER_KILL_MODULE_ID,
```

from `@/features/editor/utils/configShape`.

Add:

```ts
const isPlayerKillEnabled = useMemo(
  () => readEnabledModuleIds(configJson).includes(PLAYER_KILL_MODULE_ID),
  [configJson],
);
```

Pass the flag:

```tsx
<ClueRuntimeEffectCard
  ref={runtimeEffectRef}
  clue={clue}
  clues={clues}
  configJson={configJson}
  isPlayerKillEnabled={isPlayerKillEnabled}
  onDraftStateChange={handleRuntimeEffectStateChange}
/>
```

- [x] **Step 3: Update existing test call sites**

Every direct test render of `ClueRuntimeEffectCard` must pass `isPlayerKillEnabled`. Use `true` for existing tests that are unrelated to player-kill visibility, except the new hidden-state regression test.

- [x] **Step 4: Run GREEN verification**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/components/clues/ClueRuntimeEffectCard.test.tsx src/features/editor/components/clues/ClueEntityWorkspace.test.tsx
```

Expected: PASS.

### Task 3: Focused Validation

**Files:**
- Modify: `apps/web/e2e/editor-golden-path.spec.ts`

- [x] **Step 1: Add mocked E2E route coverage**

Add a Playwright test to `apps/web/e2e/editor-golden-path.spec.ts` that opens `/editor/${THEME_ID}/clues` with `player_kill.enabled=false`, checks that `살해 요청` is absent after `사용 가능한 아이템` is checked, reloads with `player_kill.enabled=true`, then checks that `살해 요청` is visible.

```ts
test('[2D] 플레이어킬 모듈 상태에 따라 단서 살해 요청 효과를 숨기거나 보여준다', async ({ page }) => {
  state.configJson = { modules: { player_kill: { enabled: false, config: {} } } };

  await page.goto(`${BASE}/editor/${THEME_ID}/clues`);
  await expect(page.getByLabel('단서 상세 영역')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('사용 가능한 아이템').check();
  await expect(page.getByRole('button', { name: '살해 요청' })).toHaveCount(0);

  state.configJson = { modules: { player_kill: { enabled: true, config: {} } } };
  await page.reload();
  await expect(page.getByLabel('단서 상세 영역')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('사용 가능한 아이템').check();
  await expect(page.getByRole('button', { name: '살해 요청' })).toBeVisible();
});
```

- [x] **Step 2: Run the wider focused suite**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/components/clues/ClueRuntimeEffectCard.test.tsx src/features/editor/components/clues/ClueEntityWorkspace.test.tsx src/features/editor/utils/__tests__/configShape.test.ts
```

Expected: PASS.

- [x] **Step 3: Run the targeted E2E test**

Run:

```bash
pnpm --filter @mmp/web exec playwright test e2e/editor-golden-path.spec.ts --project=chromium -g "플레이어킬 모듈 상태"
```

Expected: PASS on Chromium.

- [x] **Step 4: Check diff and working tree**

Run:

```bash
git diff --stat
git status --short --branch
```

Expected: only the plan file and scoped frontend test/component files changed.

### Self-Review

- [x] Spec coverage: off state hides `살해 요청`, on state shows it again, saved config is not destructively removed.
- [x] Placeholder scan: no `TBD`, broad TODO, or unspecified test step remains.
- [x] Type consistency: `isPlayerKillEnabled` is required where `ClueRuntimeEffectCard` is rendered.
