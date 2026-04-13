# PR-3: TradeCluePanel — trade_clue 교환 UI

## 개요
플레이어 간 단서 교환 요청/수락/거절/완료 전체 플로우.

## scope_globs
- apps/web/src/features/game/components/TradeCluePanel.tsx
- apps/web/src/features/game/components/TradeRequestNotification.tsx
- apps/web/src/features/game/components/__tests__/TradeCluePanel.test.tsx

## 백엔드 참조
- apps/server/internal/module/cluedist/trade_clue.go
- WS 이벤트: trade:request, trade:accept, trade:reject, trade:complete

## 구현 상세
1. TradeCluePanel (CluePanel 내부 or 별도):
   - 내 단서 목록에서 교환할 단서 선택
   - 대상 플레이어 선택
   - send("trade:request", { clueId, targetPlayerId })
2. TradeRequestNotification:
   - 교환 요청 수신 시 toast 또는 모달
   - 수락: send("trade:accept", { tradeId }) → 내 단서에서 제거, 상대 단서 추가
   - 거절: send("trade:reject", { tradeId })
3. 교환 완료 시 toast + CluePanel 자동 갱신

## 테스트
- 교환 요청 발송
- 요청 수신 + 수락/거절
- 완료 후 단서 목록 갱신
