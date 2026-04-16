---
run_id: r-20260415-205940-f535
wave: W1
pr: hotfix-H1
task: ClueForm 481줄 분할 + CluesTab mock 복구
status: completed
tasks_done: 4/4
tests_passed: true
files_changed:
  - apps/web/src/features/editor/components/ClueForm.tsx (481 → 230)
  - apps/web/src/features/editor/components/ClueFormAdvancedFields.tsx (new, 228)
  - apps/web/src/features/editor/components/ClueFormImageSection.tsx (new, 147)
  - apps/web/src/features/editor/hooks/useClueFormSubmit.ts (new, 110)
  - apps/web/src/features/editor/components/__tests__/ClueForm.test.tsx (new, 4 cases)
  - apps/web/src/features/editor/components/__tests__/CluesTab.test.tsx (QueryClient mock 추가)
---

# Hotfix H-1 Summary

## 변경
- ClueForm.tsx 481 → 230줄 (Advanced/Image/Submit hook 분리)
- 모든 파일 400줄·컴포넌트 150줄 이하 준수
- ClueForm 스모크 테스트 4건 추가
- CluesTab.test.tsx mock에 QueryClient 추가 (PR-3 이후 pre-existing 실패 복구)

## 테스트
- `pnpm test src/features/editor` → 45 files, 401 passed
