# Phase 16.0 — Execution Model (Wave DAG)

## Wave DAG

```
W1-PR1 (이미지캐시) ──┐
                       ├──→ W2-PR3 (모듈탭)
W1-PR2 (모달스크롤) ──┤
                       └──→ W2-PR4 (흐름템플릿)
```

## Wave 1: 버그픽스 + 모달 (parallel)

두 PR 완전 독립 — 파일 스코프 겹침 없음.

### PR-1: 단서 이미지 캐시 무효화
- **Branch**: `feat/phase-16.0/PR-1`
- **Scope**: `apps/web/src/features/editor/imageApi.ts`
- **난이도**: 극소 (1줄 추가)
- **테스트**: imageApi 캐시 무효화 단위 테스트

### PR-2: Modal 스크롤 + 버튼 고정
- **Branch**: `feat/phase-16.0/PR-2`
- **Scope**: `apps/web/src/shared/components/ui/Modal.tsx`
- **난이도**: 소 (Tailwind 클래스 추가)
- **테스트**: 모달 스크롤 동작 확인 + 회귀 체크

## Wave 2: UX 개선 (parallel)

W1 머지 후 clean base에서 시작. 두 PR 파일 스코프 겹침 없음.

### PR-3: 모듈 탭 v2 토글 리디자인
- **Branch**: `feat/phase-16.0/PR-3`
- **Scope**:
  - `apps/web/src/features/editor/components/design/ModulesSubTab.tsx`
  - `apps/web/src/features/editor/components/design/ModuleAccordionItem.tsx`
  - `apps/web/src/features/editor/constants.ts`
- **난이도**: 중 (UI 전면 리디자인)
- **테스트**: 모듈 토글 + 설정 렌더링 Vitest

### PR-4: 흐름 기본 템플릿
- **Branch**: `feat/phase-16.0/PR-4`
- **Scope**:
  - `apps/web/src/features/editor/hooks/useFlowData.ts`
  - `apps/web/src/features/editor/flowTypes.ts`
- **난이도**: 중 (초기화 로직 + 노드 배치 좌표)
- **테스트**: useFlowData 빈 flow 시 기본 템플릿 생성 Vitest

## 병렬화 효과

| 방식 | 소요 |
|------|------|
| 순차 (4 PR) | ~4T |
| 병렬 (2 wave × 2 PR) | ~2T |
| **단축** | **~50%** |
