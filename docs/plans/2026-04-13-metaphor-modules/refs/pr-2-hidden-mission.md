# PR-2: HiddenMissionCard — hidden_mission UI

## 개요
게임 시작 시 배정된 비밀 임무를 확인하고, 엔딩에서 성공/실패 결과 표시.

## scope_globs
- apps/web/src/features/game/components/HiddenMissionCard.tsx
- apps/web/src/features/game/components/MissionResultOverlay.tsx
- apps/web/src/features/game/components/__tests__/HiddenMissionCard.test.tsx

## 백엔드 참조
- apps/server/internal/module/decision/hidden_mission.go
- WS 이벤트: mission:assigned (서버→클라), mission:result (서버→클라)

## 구현 상세
1. HiddenMissionCard: 게임 중 언제든 열 수 있는 미션 카드
   - useModuleStore에서 mission (description, target 등) 구독
   - 게임 HUD에 미션 아이콘 추가 (클릭하면 카드 오버레이)
2. MissionResultOverlay: 엔딩 RevealSequence에 통합
   - mission:result 이벤트로 성공/실패 + 점수 표시

## 테스트
- 미션 카드 렌더링
- 결과 오버레이 성공/실패 케이스
