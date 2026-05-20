# 로비/대기방 Slice 2: 캐릭터 선택 계획

## 목표

- [x] 대기방에서 현재 테마의 공개 캐릭터 목록을 확인할 수 있다.
- [x] 참가자가 캐릭터를 선택/변경하면 `room_players.character_id`에 저장된다.
- [x] 같은 방 안에서 같은 캐릭터를 두 명이 선택할 수 없다.
- [x] 방의 테마와 다른 캐릭터, 플레이 불가 캐릭터, 참가자가 아닌 사용자의 선택을 거부한다.
- [x] 호스트는 모든 참가자가 캐릭터를 선택해야 게임 시작을 요청할 수 있고, 실패 사유를 볼 수 있다.

## 범위

### 포함

- [x] `PUT /v1/rooms/{id}/character` 인증 API 추가
- [x] `room_players.character_id` 저장 쿼리와 중복 방지 migration 추가
- [x] Room detail `players[].character_id` 응답 확장
- [x] `StartRoom`의 캐릭터 선택 완료 gate 추가
- [x] 프론트 공개 캐릭터 목록 query와 캐릭터 선택 mutation 추가
- [x] 대기방 캐릭터 선택 패널과 참가자 캐릭터 배지 추가
- [x] backend/frontend focused tests와 browser QA

### 이번 Slice 2 제외

- [ ] 친구 초대/초대 링크 UX
- [ ] 대기방 음성 채팅
- [ ] 게임 본편 character select WebSocket runtime 교체
- [ ] 모바일 전용 레이아웃 고도화

## 결정

- [x] 저장 계약은 HTTP `PUT /rooms/{id}/character`를 사용한다. ready/start와 같은 pre-game write path라서 REST API가 사용자 행동과 테스트를 더 명확히 만든다.
- [x] 캐릭터 중복 정책은 방 단위 unique로 고정한다. 머더미스터리 캐릭터는 역할/정보 배정의 기준이므로 중복 선택을 허용하면 시작 후 역할지와 단서 공개가 깨진다.
- [x] 공개 캐릭터 목록은 기존 `GET /themes/{id}/characters`만 사용한다. 에디터 API는 스포일러와 권한 경계가 달라 플레이어 대기방에 사용하지 않는다.

## Coverage Plan

- [x] Backend service: 성공, 방 없음, 대기 상태 아님, 참가자 아님, 다른 테마 캐릭터, 플레이 불가 캐릭터, 이미 선택된 캐릭터, 캐릭터 미선택 start gate
- [x] Backend handler: 인증 없음, 잘못된 room ID, 잘못된 body/character ID, 성공
- [x] SQL/generated: `SetRoomPlayerCharacter`, partial unique index migration, `sqlc generate`
- [x] Frontend API: `useThemeCharacters`, `useSelectRoomCharacter`
- [x] RoomPage: 캐릭터 목록 표시, 선택 mutation, 이미 선택된 캐릭터 disabled, 캐릭터 미선택 시 start disabled/사유 표시
- [x] Browser QA: 로그인 후 대기방에서 캐릭터 선택, 화면 반영, 시작 버튼 조건 확인

## Validation Plan

- [x] `cd apps/server && go test ./internal/domain/room ./cmd/server`
- [x] `pnpm --filter @mmp/web test -- RoomPage.test.tsx api.test.tsx`
- [x] `pnpm --filter @mmp/web typecheck`
- [x] 대기방 브라우저 QA
- [x] `scripts/mmp-local-ci.sh quick`

## 실행 원장

- [x] Slice 1 PR #692 merge 확인
- [x] backend/frontend read-only audit subagent 결과 회수
- [x] Slice 2 branch `feat/issue-691-character-selection` 생성
- [x] Slice 2 계획 문서 작성
- [x] backend character API/service/sqlc/migration 구현
- [x] frontend API/UI/tests 구현
- [x] focused validation
- [x] independent review/validation
- [ ] PR 생성 및 Codex review
- [ ] merge 후 #691 다음 Slice 진행
