# PR-3 — 게임 UI 아이템 사용

**Wave**: 2 · **Parallel**: ×2 · **Depends on**: PR-1 · **Branch**: `feat/game-item-ui`

## Context
게임 진행 중 아이템 단서 사용 UI. 선언 → 대상 선택 → 결과 표시 + 브로드캐스트 알림.

## Tasks

### T1: CluePanel 아이템 버튼
- [ ] `features/game/components/CluePanel.tsx` — usable 단서에 "사용" 버튼 추가
- [ ] 사용 중 다른 버튼 비활성화 (뮤텍스 상태 반영)

### T2: 아이템 사용 모달/패널
- [ ] 대상 플레이어 선택 UI
- [ ] peek 결과: 상대 단서 목록 → 선택 → 상세 표시

### T3: 브로드캐스트 알림
- [ ] `clue:item_declared` 수신 → 토스트 알림 ("OO님이 아이템을 사용합니다")
- [ ] `clue:item_resolved` 수신 → 뮤텍스 해제 상태 반영

### T4: WS 이벤트 타입
- [ ] `packages/shared/src/game/types.ts` — 신규 이벤트 타입 추가

## scope_globs
- `apps/web/src/features/game/components/CluePanel.tsx`
- `apps/web/src/features/game/components/ItemUseModal.tsx` (신규)
- `packages/shared/src/game/types.ts`
