# Phase 16.0 — Scope + 결정 상세

## 이슈 1: 단서 이미지 캐시 무효화 누락

**현상**: 단서에 이미지 업로드 후 화면에 표시 안 됨 (새로고침하면 보임)
**근본 원인**: `imageApi.ts:48` `useConfirmImageUpload.onSuccess`에서
`editorKeys.clues(themeId)` 캐시 무효화 누락. characters/theme만 무효화.
**수정**: 1줄 추가 `queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) })`

### 관련 파일
- `apps/web/src/features/editor/imageApi.ts` (48행)
- `apps/web/src/features/editor/components/ClueCard.tsx` (이미지 렌더링)
- `apps/web/src/features/editor/editorClueApi.ts` (clues 쿼리 키)

---

## 이슈 2: Modal 스크롤 부재

**현상**: 단서 등록 시 고급 옵션+아이템 설정 펼치면 15개+ 폼 요소 → 버튼 화면 밖
**근본 원인**: `Modal.tsx`에 `max-h` 없음, Body에 `overflow-y-auto` 없음
**수정**:
- Modal 컨테이너: `max-h-[90vh] flex flex-col`
- Body 영역: `overflow-y-auto flex-1`
- Footer: 자연스럽게 하단 고정 (flex-col의 마지막)

### 관련 파일
- `apps/web/src/shared/components/ui/Modal.tsx` (112~130행)
- `apps/web/src/features/editor/components/ClueForm.tsx` (218~470행)

---

## 이슈 3: 모듈 탭 v2 토글 리디자인

**현상**: 아코디언 형식이 무겁고, 코어 모듈이 항상 보임 (always true라 무의미)
**수정 방안**:
- `required=true`인 4개 코어 모듈(connection, room, ready, clue_interaction) 숨기기
- 아코디언 → 카테고리별 카드 + 토글 스위치 형식
- 활성화된 모듈만 ConfigSchema 설정 인라인 표시

### 관련 파일
- `apps/web/src/features/editor/components/design/ModulesSubTab.tsx`
- `apps/web/src/features/editor/components/design/ModuleAccordionItem.tsx`
- `apps/web/src/features/editor/constants.ts` (MODULE_CATEGORIES, REQUIRED_MODULE_IDS)

---

## 이슈 4: 흐름 기본 템플릿

**현상**: 새 테마 생성 시 빈 캔버스 → 사용자가 처음부터 노드 추가해야 함
**수정 방안**:
- 기본 템플릿: `Start → 자기소개(Phase) → 자유조사(Phase) → 투표(Phase) → Ending`
- `useFlowData`에서 flow 데이터가 빈 배열이면 기본 템플릿 자동 삽입 + 저장
- 기존 테마(이미 flow 있는)에는 영향 없음

### 관련 파일
- `apps/web/src/features/editor/hooks/useFlowData.ts` (81~95행)
- `apps/web/src/features/editor/flowTypes.ts` (노드/엣지 타입)
