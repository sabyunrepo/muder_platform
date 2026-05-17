# Scene Entry Exit Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제작자가 각 장면 설정에서 장면 시작/종료 시 실행할 액션을 편집하고, BGM이 없어도 업로드 후 바로 연결할 수 있게 한다.

**Architecture:** 저장 원본은 기존 `flow_nodes.data.onEnter` / `flow_nodes.data.onExit`를 유지한다. 액션 목록은 `ActionListEditor`를 재사용하되, 장면 패널용 허용 액션을 `sceneActionRegistry`에서 계산해 모듈 활성 상태에 따라 새 액션 추가 목록만 필터링한다. 기존 저장 액션은 모듈이 꺼져도 표시해 제작자가 데이터를 잃지 않게 한다.

**Tech Stack:** React 19, TanStack Query, Tailwind CSS, Vitest Testing Library, existing editor flow/media APIs.

---

## File Structure

- Modify: `apps/web/src/features/editor/components/design/PhaseNodePanel.tsx`
  - `ActionListEditor`를 장면 시작/종료 섹션으로 연결한다.
  - theme config 기반 허용 액션을 계산한다.
- Modify: `apps/web/src/features/editor/components/design/ActionListEditor.tsx`
  - 숨겨진 기존 액션을 보존 표시한다.
  - 액션별 기본 params를 registry에서 가져오게 한다.
- Modify: `apps/web/src/features/editor/components/design/PresentationCueFields.tsx`
  - `STOP_AUDIO`/`stop_bgm` 같은 종료 액션은 미디어 선택 없이 완료 상태로 다룬다.
  - BGM 선택은 기존 `MediaPicker` 업로드 흐름을 그대로 사용한다.
- Create: `apps/web/src/features/editor/entities/sceneAction/sceneActionRegistry.ts`
  - 장면 액션 정의, 기본 params, 모듈 필터링, 완료 검증을 담당한다.
- Test: `apps/web/src/features/editor/entities/sceneAction/__tests__/sceneActionRegistry.test.ts`
- Test: `apps/web/src/features/editor/components/design/__tests__/ActionListEditor.test.tsx`
- Test: `apps/web/src/features/editor/components/design/__tests__/PhaseNodePanelExtended.test.tsx`

## Task 1: Scene Action Registry

- [ ] **Step 1: Write failing registry tests**

```ts
expect(getSceneActionOptions({ enabledModuleIds: [] }).some((a) => a.value === "GRANT_INVESTIGATION_TOKEN")).toBe(false);
expect(getSceneActionOptions({ enabledModuleIds: ["deck_investigation"] }).some((a) => a.value === "GRANT_INVESTIGATION_TOKEN")).toBe(true);
expect(createSceneActionDefaultParams("SET_BGM")).toEqual({});
expect(createSceneActionDefaultParams("STOP_AUDIO")).toEqual({ scope: "bgm" });
expect(isSceneActionComplete({ type: "STOP_AUDIO", params: { scope: "bgm" } })).toBe(true);
```

- [ ] **Step 2: Implement registry**

Create `sceneActionRegistry.ts` with constants for always available actions and module-gated actions. Keep internal action type strings in code only; UI labels stay creator-friendly.

- [ ] **Step 3: Run registry tests**

Run: `pnpm --filter @mmp/web test -- sceneActionRegistry.test.ts`

## Task 2: Action Editor Integration

- [ ] **Step 1: Update `ActionListEditor` tests**

Add tests for:
- `allowedTypes` controls add/select options.
- Existing disallowed action still renders as `(기존값)`.
- `STOP_AUDIO` is not treated as incomplete.

- [ ] **Step 2: Update `ActionListEditor`**

Use registry helpers for default params and incomplete validation. Keep current field components for information, broadcast, media cues.

- [ ] **Step 3: Run focused tests**

Run: `pnpm --filter @mmp/web test -- ActionListEditor.test.tsx`

## Task 3: Phase Panel Entry/Exit Sections

- [ ] **Step 1: Update `PhaseNodePanelExtended` tests**

Assert that a phase node shows:
- `장면 시작 액션`
- `장면 종료 액션`
- `BGM 설정`
- `BGM 종료`

Assert that changing an entry action calls:

```ts
expect(onUpdate).toHaveBeenCalledWith("node-1", {
  onEnter: [expect.objectContaining({ type: "SET_BGM" })],
});
```

- [ ] **Step 2: Render action sections**

Add two `ActionListEditor` instances:
- label `장면 시작 액션`, value `data.onEnter ?? []`
- label `장면 종료 액션`, value `data.onExit ?? []`

Use `handleChange({ onEnter: actions })` and `handleChange({ onExit: actions })`.

- [ ] **Step 3: Run focused tests**

Run: `pnpm --filter @mmp/web test -- PhaseNodePanelExtended.test.tsx`

## Task 4: BGM Upload/Link Validation

- [ ] **Step 1: Verify MediaPicker reuse**

`PresentationCueFields` should pass `filterType="BGM"` and `useCase="phase_bgm"` for `SET_BGM`. Existing `MediaPicker` opens `MediaUploadModal`, so BGM 없는 상태에서도 업로드 버튼이 available.

- [ ] **Step 2: Add test coverage**

Mock empty `useMediaList` and assert `BGM 선택` button renders. For modal upload internals, rely on `MediaPicker` tests because this component only opens the picker.

## Task 5: Validation and PR

- [ ] **Step 1: Run focused tests**

```bash
pnpm --filter @mmp/web test -- sceneActionRegistry.test.ts ActionListEditor.test.tsx PhaseNodePanelExtended.test.tsx
```

- [ ] **Step 2: Run local quick CI**

```bash
scripts/mmp-local-ci.sh quick
```

- [ ] **Step 3: Commit and create PR**

```bash
git add apps/web/src/features/editor docs/superpowers/plans/2026-05-17-scene-entry-exit-actions.md
git commit -m "feat(web): add scene entry and exit actions"
scripts/pr-create-guard.sh --title "장면 시작·종료 액션 설정과 BGM 연동 추가" --body-file /tmp/scene-entry-exit-actions-pr.md
```

- [ ] **Step 4: Review and merge**

Use CodeRabbit review, resolve actionable comments, verify unresolved review threads are 0, then merge.
