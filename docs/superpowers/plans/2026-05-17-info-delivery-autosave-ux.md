# Info Delivery Autosave UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보관리의 장면 시작 배포 설정을 장면 선택 중심 UI와 자동저장 흐름으로 개선한다.

**Architecture:** 저장 source-of-truth는 기존 `flow_nodes.data.onEnter`의 `DELIVER_INFORMATION` 액션으로 유지한다. UI는 모든 장면을 카드로 펼치지 않고 `SceneSelectField`로 장면 하나를 고른 뒤, `OptionList` 기반 대상 선택 패널에서 전체 캐릭터 또는 특정 캐릭터를 선택하게 한다.

**Tech Stack:** React 19, TanStack Query mutation hooks, `useDebouncedMutation`, `sonner`, Vitest + Testing Library.

---

### Task 1: UI Flow Reshape

**Files:**
- Modify: `apps/web/src/features/editor/components/info/InfoDeliverySettingsCard.tsx`

- [x] Replace per-phase cards with a single scene selector.
- [x] Reuse `SceneSelectField` for phase selection.
- [x] Reuse `OptionList` for delivery target selection.
- [x] Keep `readInfoDeliveryTarget` and `writeInfoDeliveryTarget` unchanged.

### Task 2: Autosave

**Files:**
- Modify: `apps/web/src/features/editor/components/info/InfoDeliverySettingsCard.tsx`

- [x] Remove the `배포 적용` button.
- [x] Use `useDebouncedMutation` with 1500ms debounce.
- [x] Flush pending saves when the selected scene changes and when delivery controls blur.
- [x] Show `sonner` toast states for saving, saved, failed, and retry.

### Task 3: Tests

**Files:**
- Modify: `apps/web/src/features/editor/components/info/__tests__/InfoTab.test.tsx`

- [x] Update the existing delivery test to use the scene selector and autosave timer.
- [x] Add coverage for retry toast on save failure.
- [x] Keep existing info body save tests passing.

### Task 4: Validation

**Commands:**
- [x] `pnpm --filter @mmp/web test -- InfoTab.test.tsx infoDeliverySettingsAdapter.test.ts`
- [x] `pnpm --filter @mmp/web typecheck`
- [x] `pnpm --filter @mmp/web lint`
- [ ] `scripts/mmp-local-ci.sh quick`
