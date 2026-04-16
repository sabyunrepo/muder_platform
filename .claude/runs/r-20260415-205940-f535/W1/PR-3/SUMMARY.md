---
run_id: r-20260415-205940-f535
wave: W1
pr: PR-3
task: upload-url path + clue image setQueryData
status: completed
tasks_done: 4/4
tests_passed: true
files_changed:
  - apps/web/src/features/editor/imageApi.ts
  - apps/web/src/features/editor/editorClueApi.ts
  - apps/web/src/features/editor/components/ClueForm.tsx
  - apps/web/src/features/editor/components/ImageCropUpload.tsx
  - apps/web/src/features/editor/__tests__/imageApi.test.ts
  - apps/web/src/features/editor/__tests__/editorClueApi.test.ts
---

# PR-3 Summary

## 변경
- `imageApi.ts`: upload-url 경로 단일 prefix 보장
- `editorClueApi.ts`: useCreateClue onSuccess setQueryData 낙관 반영 + 이미지 업로드 후 merge
- `ClueForm.tsx`, `ImageCropUpload.tsx`: themeId guard 추가
- 테스트: imageApi 7 cases + editorClueApi 4 cases

## 테스트
- `vitest run ... 2 test files, 11 tests passed`
