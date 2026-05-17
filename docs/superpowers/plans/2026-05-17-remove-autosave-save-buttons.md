# Remove Autosave Save Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동저장이 적용된 에디터 화면에서 혼동되는 일반 저장 버튼을 제거한다.

**Architecture:** 저장 동작은 기존 자동저장 훅과 토스트를 유지하고, UI에서 수동 저장 버튼만 제거한다. 명시적 확정이 필요한 모달/트리거/역할지 저장 버튼은 자동저장 흐름이 아니므로 유지한다.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, MMP editor autosave hooks.

---

## Files

- Modify: `apps/web/src/features/editor/components/info/InfoTab.tsx`
- Modify: `apps/web/src/features/editor/components/info/__tests__/InfoTab.test.tsx`
- Modify: `apps/web/src/features/editor/components/reading/ReadingSectionEditor.tsx`
- Modify: `apps/web/src/features/editor/components/reading/__tests__/ReadingSectionEditor.test.tsx`
- Modify: `apps/web/src/features/editor/components/OverviewTab.tsx`
- Modify: `apps/web/src/features/editor/components/__tests__/Editor.test.tsx`
- Modify: `apps/web/src/features/editor/components/design/LocationDetailPanel.tsx`
- Modify: `apps/web/src/features/editor/components/design/__tests__/LocationsSubTab.basicInfo.test.tsx`

## Tasks

- [x] Remove the `InfoTab` edit-mode save button and unused manual save branch.
- [x] Update `InfoTab` tests so save behavior is asserted through autosave instead of button clicks.
- [x] Remove the `ReadingSectionEditor` save button and keep validation feedback tied to autosave errors.
- [x] Update reading section tests so automatic save and validation behavior remain covered.
- [x] Remove `OverviewTab` submit save button and prevent form submit from being the primary save path.
- [x] Update overview/theme tests for autosave-only behavior.
- [x] Remove `LocationDetailPanel` basic info save button while keeping delete and other explicit actions.
- [x] Update location basic info tests for autosave-only behavior.
- [x] Run focused frontend tests, typecheck, and local quick validation.
- [ ] Create PR with Coverage Plan, handle CodeRabbit, and merge.
