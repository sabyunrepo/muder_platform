# Phase 14.0 — Execution Model (Wave DAG)

> 부모: [../design.md](../design.md)

---

## Wave DAG

```
W1 (parallel):  PR-1 ─────┐
                PR-2 ─────┤
                           │
W2 (parallel):  PR-3 ─────┤  (depends: W1)
                PR-4 ─────┤
                           │
W3 (sequential): PR-5 ────┘  (depends: PR-3, PR-4)
```

---

## PR 의존 관계

| PR | Title | Depends On | Wave | Isolation |
|----|-------|------------|------|-----------|
| PR-1 | 이미지 업로드 400 fix | - | W1 | worktree |
| PR-2 | 에디터 반응형 대응 | - | W1 | worktree |
| PR-3 | 히든미션 재설계 + 단서 compact | W1 | W2 | worktree |
| PR-4 | 모듈+설정 탭 통합 | W1 | W2 | worktree |
| PR-5 | 게임설계 탭 구조 재편 | PR-3, PR-4 | W3 | - |

---

## PR별 scope_globs

### PR-1
```
apps/web/src/features/editor/imageApi.ts
apps/web/src/features/editor/components/ImageCropUpload.tsx
apps/web/src/features/editor/components/CoverImageCropUpload.tsx
apps/web/src/features/editor/components/ClueForm.tsx
```

### PR-2
```
apps/web/src/features/editor/components/EditorLayout.tsx
apps/web/src/features/editor/components/design/PhaseTimeline.tsx
apps/web/src/features/editor/components/design/PhaseCard.tsx
apps/web/src/features/editor/components/design/ModulesSubTab.tsx
apps/web/src/features/editor/components/design/LocationsSubTab.tsx
apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx
apps/web/src/features/editor/components/design/AssignmentSubTab.tsx
```

### PR-3
```
apps/web/src/features/editor/components/design/MissionEditor.tsx
apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx
apps/web/src/features/editor/components/CluesTab.tsx
apps/web/src/features/editor/constants.ts
```

### PR-4
```
apps/web/src/features/editor/components/design/ModulesSubTab.tsx
apps/web/src/features/editor/components/design/SettingsSubTab.tsx (삭제)
apps/web/src/features/editor/components/DesignTab.tsx
apps/web/src/features/editor/components/SchemaDrivenForm.tsx
```

### PR-5
```
apps/web/src/features/editor/components/DesignTab.tsx
apps/web/src/features/editor/components/design/AssignmentSubTab.tsx
apps/web/src/features/editor/components/CharactersTab.tsx
apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx
```

---

## 머지 순서

1. PR-1 → PR-2 (W1 완료)
2. PR-3 → PR-4 (W2 완료, PR-3 먼저 — 단서 관련 파일 충돌 방지)
3. PR-5 (W3 완료)

각 wave 종료 시 user 확인 1회.
