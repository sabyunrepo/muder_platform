# Phase 18.0 — Scope + 결정 상세

## 이미 구현된 백엔드

| 파일 | 내용 |
|------|------|
| `internal/engine/phase_engine.go` | PhaseEngine (linear, panic isolation) |
| `internal/engine/event_bus.go` | 세션 스코프 이벤트 버스 |
| `internal/engine/rule_evaluator.go` | JSON Logic 룰 평가 |
| `internal/engine/registry.go` | 모듈 레지스트리 |
| `internal/engine/module_types.go` | BaseModule, PhaseReactor 인터페이스 |
| `internal/session/session.go` | Session goroutine (Actor) |
| `internal/session/manager.go` | SessionManager |
| `internal/session/panic_guard.go` | panic isolation |

## 미구현 (이 Phase 범위)

### Backend
- Hub→Session.Inbox 메시지 라우팅 (envelope dispatch)
- `startModularGame(room, configJson)` — 모듈 팩토리 호출 + 엔진 시작
- EventMapping 구독 (module event → WS broadcast 자동 변환)
- Redis 스냅샷 직렬화/역직렬화

### Frontend
- gameSessionStore (Zustand) — phase, timer, players, module states
- WS 게임 메시지 핸들러 (`phase:changed`, `chat:message` 등)
- GameLayout (PhaseBar + timer + content area)
- 모듈 UI 5종 (채팅, 투표, 단서열람, 리딩, 엔딩)
- 재접속 시 snapshot hydration

## MVP 모듈 선택 (5/29)

| 모듈 | 이유 |
|------|------|
| text_chat | 핵심 소통 수단 |
| voting | 범인 투표 — 게임 코어 |
| clue_interaction | 단서 열람/공유 — 게임 코어 |
| reading | 대사 낭독 — 몰입 핵심 |
| ending | 결과 표시 — 게임 종료 필수 |

나머지 24개 모듈은 후속 Phase에서 추가.

## WS Envelope 형식

```json
{
  "type": "chat:send",
  "sessionId": "uuid",
  "payload": { "text": "hello", "target": "all" }
}
```
서버 응답:
```json
{
  "type": "chat:message",
  "payload": { "from": "player-1", "text": "hello", "ts": 1234 }
}
```

## Feature Flag

`game_runtime_v2` in `feature_flags` 테이블 (Phase 10.0에서 구현됨).
- 방 시작 API에서 flag 체크
- 프론트 라우터에서 flag 기반 게임 화면 분기
