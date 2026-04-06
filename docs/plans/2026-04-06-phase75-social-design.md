# Phase 7.5 소셜 시스템 — 구현 계획서

> 4명 전문가(백엔드/DB/프론트/보안) 토론 결과 종합. 2026-04-06 작성.

## 현황 요약

기존 구현이 예상보다 많이 완료됨. **REST + DB ~85%, 프론트 ~70%, WS 실시간 ~0%**.

| 영역 | 완료 | 남은 핵심 작업 |
|------|------|---------------|
| DB 스키마 (00007) | 5개 테이블 존재 | ALTER TABLE: updated_at, role, metadata, deleted_at, IMAGE |
| sqlc 쿼리 (25개) | CRUD 완비 | 7개 추가 (soft delete, cursor, totalUnread 등) |
| Go Service | FriendService + ChatService | 차단 필터링, validMessageTypes IMAGE 추가 |
| Go REST Handler | 전 엔드포인트 연결 | 보안 보강 (rate limit) |
| **Go WS** | **미구현** | **SocialHub, Presence, WS Handler, Bridge** |
| 프론트 스토어 | socialStore + connectionStore | totalUnread 추가 |
| 프론트 hooks | React Query 22개 + useSocialSync | **useSocialSync 마운트**, useInfiniteMessages |
| 프론트 컴포넌트 | FriendsList + ChatList + ChatRoom | 게임카드, 타이핑 UI, 무한스크롤, 반응형 |
| 보안 | JWT, CORS, sqlc | **WS JWT 인증, SocialHub 분리, Rate Limit, 차단 우회 방지** |

## 아키텍처 결정

### D1. SocialHub 분리 (게임 Hub 재사용 안 함)
- 게임: `sessions[sessionID][playerID]` 2레벨, 소셜: `users[userID]` 1레벨
- 생명주기 차이: 게임(수시간) vs 소셜(영구)
- ReconnectBuffer: 게임 필요, 소셜 불필요 (DB 영속화)
- Router/Envelope/PubSub는 재사용

### D2. WS 인증: JWT PlayerIDExtractor
- 기존 DefaultPlayerIDExtractor(query param)를 JWT 기반으로 교체
- WS는 Authorization 헤더 불가 → `?token=` 쿼리파라미터로 JWT 전달
- prod에서 query-param auth 차단 guard 이미 존재, JWT 용은 별도 경로

### D3. Redis Presence: SETEX + heartbeat
- `mmp:presence:{userID}` — TTL 90초, heartbeat 60초
- 서버 크래시 시 90초 후 자동 offline
- 친구 온라인 목록: MGET 일괄 조회 (O(N) 단일 RTT)

### D4. 메시지 metadata: JSONB
- GAME_INVITE, GAME_RESULT, IMAGE 등 타입별 가변 필드
- Go에서 `json.RawMessage`로 매핑 (sqlc.yaml에 이미 설정)

### D5. Soft Delete: deleted_at + partial index
- 카카오톡 "삭제됨" 패턴
- `idx_chat_messages_not_deleted(chat_room_id, id DESC) WHERE deleted_at IS NULL`

### D6. 프론트 WS 마운트: MainLayout
- 인증된 모든 페이지에서 소셜 WS 활성화 (알림, unread 배지)
- MainLayout에서 useWsClient + useSocialSync 호출

---

## 구현 단계 (8 Step)

### Step 1: DB 마이그레이션 + sqlc
- `00014_social_enhancements.sql` — 5개 컬럼 ALTER + 2개 인덱스
- `social.sql` 쿼리 수정 5개 + 신규 7개
- `sqlc generate` 실행
- `validMessageTypes`에 IMAGE 추가

### Step 2: 보안 보강 — 차단 필터링
- `SendMessage()` 차단 여부 확인 (DM)
- `GetOrCreateDMRoom()` 차단 여부 확인
- `CreateGroupRoom()` 차단/존재 검증
- `IsBlocked` 양방향 쿼리 추가

### Step 3: SocialHub + JWT WS 인증
- `ws/social_hub.go` — userID 기반 인덱싱, rooms 맵
- `ws/upgrade.go` — JWTPlayerIDExtractor 추가
- 기존 Hub register에 동일 ID 기존 연결 정리 로직
- SocialHub PubSub 채널: `mmp:social:` prefix

### Step 4: PresenceProvider + SocialWSHandler
- `domain/social/presence.go` — Redis SETEX presence
- `domain/social/ws_handler.go` — chat:send/typing/read + friend:* 핸들러
- WS 메시지 rate limiter (메시지 전송 100ms cooldown)

### Step 5: SocialBridge + EventBus 이벤트
- `bridge/social_bridge.go` — 게임→소셜 이벤트 파이프라인
- `eventbus/events.go` — GameInviteSent, GameEnded 이벤트 추가
- main.go DI 조립 + `/ws/social` 재연결

### Step 6: 프론트엔드 WS 마운트 + 실시간
- MainLayout에 useWsClient({endpoint:"social"}) + useSocialSync() 마운트
- @mmp/shared WsEventType에 소셜 이벤트 추가
- 타이핑 인디케이터 UI + 전송 (300ms debounce)
- totalUnread 계산 + Nav/Sidebar 배지

### Step 7: 프론트엔드 기능 완성
- GameInviteCard + GameResultCard 메시지 렌더링
- useInfiniteMessages (역방향 무한 스크롤)
- 옵티미스틱 업데이트 (메시지 전송)
- 읽음 확인 표시 UI (체크마크)
- 친구 요청 실시간 알림 (toast)
- 모바일 반응형 (768px 이하 리스트↔채팅 전환)

### Step 8: 테스트 + 통합 검증
- Go: SocialHub, Presence, WSHandler, Bridge 테스트
- FE: 신규 컴포넌트 테스트 추가
- E2E: WS 연결 → 메시지 전송 → 수신 → 읽음 확인 시나리오

---

## WS 메시지 타입 정리

| Type | 방향 | 설명 |
|------|------|------|
| `chat:send` | C→S | 메시지 전송 (DB 저장 + broadcast) |
| `chat:typing` | C→S | 타이핑 시작 (ephemeral, DB 불필요) |
| `chat:read` | C→S | 읽음 확인 (DB 업데이트 + broadcast) |
| `chat:message` | S→C | 새 메시지 도착 |
| `chat:typing_indicator` | S→C | 타이핑 중 알림 |
| `chat:read_receipt` | S→C | 읽음 확인 전파 |
| `friend:request` | S→C | 친구 요청 수신 |
| `friend:accepted` | S→C | 친구 수락 알림 |
| `friend:online` | S→C | 온라인 상태 변경 |
| `friend:offline` | S→C | 오프라인 상태 변경 |
| `presence:heartbeat` | C→S | 온라인 상태 갱신 (60초 간격) |

## 보안 체크리스트

- [ ] SocialHub/Router 분리 (게임 namespace 접근 차단)
- [ ] JWT WS 인증 (DefaultPlayerIDExtractor 교체)
- [ ] 사용자당 WS 연결 수 제한 (기존 연결 정리)
- [ ] REST rate limiter (Redis sliding window, 소셜 30req/min)
- [ ] WS 메시지 rate limiter (100ms cooldown)
- [ ] 차단 사용자 메시지 필터링 (DM 전송/생성)
- [ ] 그룹 채팅 멤버 추가 시 차단/존재 검증
- [ ] 온라인 상태 친구에게만 노출
