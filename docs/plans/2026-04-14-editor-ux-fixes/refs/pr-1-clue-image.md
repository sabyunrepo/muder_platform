# PR-1: 단서 이미지 캐시 무효화

> Wave 1 | 의존: 없음 | Branch: `feat/phase-16.0/PR-1`

## 문제

`useConfirmImageUpload` 의 `onSuccess`에서 `editorKeys.clues(themeId)` 캐시 무효화 누락.
이미지 업로드 완료 후 CluesTab이 stale 데이터를 표시 → 이미지 안 보임.

## 수정 대상

| 파일 | 변경 |
|------|------|
| `apps/web/src/features/editor/imageApi.ts` | clues 캐시 무효화 1줄 추가 |

## Tasks

### Task 1: 캐시 무효화 추가
`imageApi.ts`의 `useConfirmImageUpload` onSuccess에:
```typescript
queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
```

### Task 2: 테스트 작성
- imageApi의 onSuccess에서 clues 캐시 무효화가 호출되는지 Vitest 확인
- 기존 characters/theme 무효화가 유지되는지 확인

## 검증

- [ ] 단서 이미지 업로드 → 즉시 ClueCard에 이미지 표시
- [ ] 캐릭터 이미지 업로드 기존 동작 유지
- [ ] `pnpm test` pass
