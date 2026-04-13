<!-- STATUS:READY -->
# Phase 12.0 체크리스트

## Wave 1 (병렬)
### PR-1: ReadingPanel — reading 모듈 UI
- [ ] WS 이벤트 타입 정의 (reading:content, reading:done)
- [ ] ReadingPanel.tsx 컴포넌트 구현
- [ ] useModuleStore 연동
- [ ] 읽기 완료 버튼 + send(reading:done)
- [ ] Vitest 단위 테스트
- [ ] constants.ts reading supported: true → 이미 true 확인

### PR-2: HiddenMissionCard — hidden_mission UI
- [ ] WS 이벤트 타입 정의 (mission:assigned, mission:result)
- [ ] HiddenMissionCard.tsx 컴포넌트 (게임 중 미션 확인)
- [ ] MissionResultOverlay.tsx (엔딩에서 성공/실패 표시)
- [ ] useModuleStore 연동
- [ ] Vitest 단위 테스트
- [ ] constants.ts hidden_mission supported: true 업데이트

## Wave 2 (병렬)
### PR-3: TradeCluePanel — trade_clue 교환 UI
- [ ] WS 이벤트 타입 정의 (trade:request/accept/reject/complete)
- [ ] TradeCluePanel.tsx (교환 요청 발송 UI)
- [ ] TradeRequestNotification.tsx (수신 알림 + 수락/거절)
- [ ] 교환 완료 toast/애니메이션
- [ ] useModuleStore 연동
- [ ] Vitest 단위 테스트
- [ ] constants.ts trade_clue supported: true 업데이트

### PR-4: GroupChatTab — group_chat (GameChat 확장)
- [ ] WS 이벤트 타입 정의 (chat:group_message, chat:group_create)
- [ ] GameChat.tsx에 그룹 탭 추가
- [ ] 그룹 생성/참여 UI
- [ ] 그룹 메시지 표시
- [ ] Vitest 단위 테스트
- [ ] constants.ts group_chat supported: true 업데이트

## Wave 3
### PR-5: 통합 + supported 플래그 최종 업데이트
- [ ] 전체 모듈 supported 플래그 정리
- [ ] 메타포 시드 테마로 게임 플로우 수동 검증
- [ ] consensus_control 프론트엔드 필요 여부 최종 확인
