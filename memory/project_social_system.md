---
name: 소셜 시스템 아키텍처
description: Phase 7.5 소셜 시스템 — SocialHub, Presence, WS 핸들러, 차단 필터링 구조
type: project
---

## 아키텍처 결정

- **SocialHub 분리**: 게임 Hub(sessionID 기반)과 별도 SocialHub(userID 기반) 운영
- **ClientHub 인터페이스**: `ws.Client`가 Hub/SocialHub 양쪽에서 동작하도록 추상화
- **WS 인증**: prod에서 JWT(`?token=`), dev에서 `?player_id=` fallback
- **Presence**: Redis SETEX (TTL 90초) + heartbeat 60초, 서버 크래시 시 자동 offline

## WS 메시지 타입

| Type | 방향 | 설명 |
|------|------|------|
| chat:send/typing/read | C→S | 메시지 전송/타이핑/읽음 |
| chat:message/typing_indicator/read_receipt | S→C | 실시간 push |
| friend:request/accepted/online/offline | S→C | 친구 이벤트 push |
| presence:heartbeat | C→S | 온라인 상태 갱신 |

## 핵심 파일

- `internal/ws/social_hub.go` — SocialHub (JoinRoom/BroadcastToRoom/SendToUser)
- `internal/ws/client.go` — ClientHub 인터페이스 정의
- `internal/domain/social/presence.go` — Redis PresenceProvider
- `internal/domain/social/ws_handler.go` — SocialWSHandler (chat/friend/presence 핸들러)
- `internal/domain/social/service.go` — 차단 필터링 (SendMessage, GetOrCreateDMRoom)

## 보안

- 차단 사용자 DM 전송/생성 차단 (`ErrChatBlocked`)
- 사용자당 WS 연결 1개 강제 (기존 연결 자동 정리)
- DB migration 00014: role, metadata, deleted_at, IMAGE 타입 추가

**How to apply:** 소셜 관련 작업 시 SocialHub 패턴 참조. 게임 Hub과 혼용 금지.
