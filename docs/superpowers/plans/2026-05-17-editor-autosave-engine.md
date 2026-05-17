# Editor Autosave Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile per-screen autosave draft handling with a reusable editor autosave draft engine that preserves local edits during server refetches.

**Architecture:** Keep `useDebouncedMutation` as the low-level delay/flush primitive. Add a higher-level `useAutosavedDraft` hook under editor hooks to own draft, baseline, dirty state, submitted snapshot checks, server refresh policy, flush-on-unmount, and toast-compatible save status. Migrate the bug-prone Info and Reading editors first; leave graph/clue specialized flows on existing primitives until they need draft ownership.

**Tech Stack:** React 19 hooks, Vitest, Testing Library, existing MMP editor API hooks, existing `useDebouncedMutation`.

---

## Coverage Plan

- `apps/web/src/features/editor/hooks/useAutosavedDraft.ts`: unit tests cover dirty draft protection, submitted snapshot success handling, server refresh while clean, server refresh while dirty, flush/cancel behavior.
- `apps/web/src/features/editor/components/info/InfoTab.tsx`: focused component test covers typing additional characters while an earlier autosave refetch returns stale data.
- `apps/web/src/features/editor/components/reading/ReadingSectionEditor.tsx`: focused component or hook-level coverage verifies server section refresh does not overwrite dirty draft.
- Existing `useDebouncedMutation` tests remain unchanged and validate low-level timer behavior.

## Files

- Create: `apps/web/src/features/editor/hooks/useAutosavedDraft.ts`
- Create: `apps/web/src/features/editor/hooks/__tests__/useAutosavedDraft.test.tsx`
- Modify: `apps/web/src/features/editor/components/info/InfoTab.tsx`
- Modify: `apps/web/src/features/editor/components/info/__tests__/InfoTab.test.tsx`
- Modify: `apps/web/src/features/editor/components/reading/ReadingSectionEditor.tsx`
- Modify: `apps/web/src/features/editor/components/reading/__tests__/ReadingSectionEditor.test.tsx`

## Tasks

- [ ] Add `useAutosavedDraft` with clear options: `serverValue`, `toDraft`, `isEqual`, `save`, `debounceMs`, `messages`, `onConflict`, `onError`.
- [ ] Make the hook preserve local dirty draft when `serverValue` identity changes, while updating the accepted baseline/version only when safe.
- [ ] Make save success clear dirty only when the submitted draft is still the current draft.
- [x] Add focused tests for the new hook.
- [x] Replace `InfoTab` local draft/baseline autosave logic with the new hook.
- [x] Add regression test for `지도` not reverting to `지` after stale refetch.
- [x] Replace `ReadingSectionEditor` reset-on-section-change logic with the new hook or a compatible adapter.
- [x] Run focused tests and typecheck.
- [x] Create PR with Coverage Plan and local validation evidence.
- [ ] Complete PR review and merge.
