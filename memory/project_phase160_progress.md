---
name: Phase 16.0 완료
description: 에디터 UX 버그픽스 + 개선 — 4 PR, 2 Wave, 이미지 캐시/모달 스크롤/모듈 토글/흐름 템플릿 + 핫픽스 3건
type: project
---
Phase 16.0 — **완료** (2026-04-14)

## PR 목록
| PR | 커밋 | 내용 |
|----|------|------|
| PR-1 | `88c4663` | 단서 이미지 캐시 무효화 (`editorKeys.clues`) |
| PR-2 | `e2b10bc` | Modal `max-h-[90vh]` + flex-col + overflow 스크롤 |
| PR-3 | `5c0a99a` | 모듈 탭 리디자인 — 코어 숨김 + 카드+토글 + `OPTIONAL_MODULE_CATEGORIES` |
| PR-4 | `ff96628` | 흐름 기본 템플릿 — `flowDefaults.ts` + `flowConverters.ts` 분할 |

## 핫픽스 (Phase 16.0 도중 발견)
| 커밋 | 내용 |
|------|------|
| `d9b5e84` | UUID flow IDs + 이미지 10MB 검증 + 409 conflict 핸들링 |
| `6087585` | null-safe flow data + 이미지 제한 10MB |
| `47d062f` | `useSaveFlow` invalidateGraph 제거 — save→refetch 무한 루프 수정 |

## 테스트
- 806 passed (19 pre-existing Social.test.tsx 실패)
- DB 마이그레이션 21 (flow_nodes/flow_edges) 수동 적용 필요했음

## 주요 발견
- `uploadImage()` 헬퍼 함수가 `useConfirmImageUpload` 훅을 우회 → 캐시 무효화 위치 주의
- flow API에서 `onSuccess: invalidateGraph`가 autoSave와 무한 루프 유발 → save mutation에서 제거
