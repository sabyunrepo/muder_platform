<!-- STATUS:DONE -->
# Phase 12.0 체크리스트

## Wave 1 (병렬)
### PR-1: ReadingPanel — reading 모듈 UI
- [x] WS 이벤트 타입 정의 (reading:content, reading:done)
- [x] ReadingPanel.tsx 컴포넌트 구현
- [x] useModuleStore 연동
- [x] 읽기 완료 버튼 + send(reading:done)
- [x] Vitest 단위 테스트
- [x] constants.ts reading supported: true → 이미 true 확인

### PR-2: HiddenMissionCard — hidden_mission UI
- [x] WS 이벤트 타입 정의 (mission:assigned, mission:result)
- [x] HiddenMissionCard.tsx 컴포넌트 (게임 중 미션 확인)
- [x] MissionResultOverlay.tsx (엔딩에서 성공/실패 표시)
- [x] useModuleStore 연동
- [x] Vitest 단위 테스트
- [x] constants.ts hidden_mission supported: true 업데이트

## Wave 2 (병렬)
### PR-3: TradeCluePanel — trade_clue 교환 UI
- [x] WS 이벤트 타입 정의 (trade:request/accept/reject/complete)
- [x] TradeCluePanel.tsx (교환 요청 발송 UI)
- [x] TradeRequestNotification.tsx (수신 알림 + 수락/거절)
- [x] 교환 완료 toast/애니메이션
- [x] useModuleStore 연동
- [x] Vitest 단위 테스트
- [x] constants.ts trade_clue supported: true 업데이트

### PR-4: GroupChatTab — group_chat (GameChat 확장)
- [x] WS 이벤트 타입 정의 (chat:group_message, chat:group_create)
- [x] GameChat.tsx에 그룹 탭 추가
- [x] 그룹 생성/참여 UI
- [x] 그룹 메시지 표시
- [x] Vitest 단위 테스트
- [x] constants.ts group_chat supported: true 업데이트

## Wave 3
### PR-5: 통합 + supported 플래그 최종 업데이트
- [x] 전체 모듈 supported 플래그 정리
- [x] 메타포 시드 테마로 게임 플로우 수동 검증
- [x] consensus_control 프론트엔드 필요 여부 최종 확인
