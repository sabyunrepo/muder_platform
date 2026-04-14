# Phase 18.0 — 데이터 흐름 참조

## 기존 설계 문서 포인터

상세 데이터 흐름은 이미 작성됨. 이 파일은 참조 포인터.

### 4대 흐름 (Phase 8.0 설계)
| 흐름 | QMD docid | 원본 경로 |
|------|-----------|----------|
| 게임 시작 | #377d29 | `2026-04-08-engine-integration/refs/data-flow.md` |
| In-game 메시지 | 같은 파일 §2 | reading:advance 예시 |
| Disconnect/Reconnect | 같은 파일 §3 | 호스트/비호스트 분기 |
| Phase 전환 | 같은 파일 §4 | 타이머/합의/GM 트리거 |

### 엔진 설계 (Phase 9.0)
| 항목 | QMD docid | 내용 |
|------|-----------|------|
| 게임 엔진 상세 | #4b7e6f | ProgressionStrategy 3종, ActionDispatcher |
| PhaseEngine PR | #d0f584 §PR-A4 | phase_engine.go 구현 상세 |

### 이 Phase에서 구현할 연결 포인트

```
[방 시작 버튼]
  → POST /rooms/:id/start
  → handler: validate host + check ready + load configJson
  → session.Manager.Start(roomID, config)           ← PR-2
  → NewSession → go session.Run(ctx)
  → engine.Start → enterCurrentPhase → onEnter actions
  → eventBus → EventMapping → Hub.Broadcast         ← PR-1
  → WS → 클라이언트 gameSessionStore                  ← PR-3
  → GameLayout → PhaseBar + 모듈 UI                   ← PR-4~7
```

### 스냅샷 흐름 (PR-8)

```
[Session goroutine]
  → 이벤트 처리 완료마다 dirty flag
  → 5초 throttle ticker → persistSnapshot(force=false)
  → phase 전환 시 → persistSnapshot(force=true)  ← critical

[재접속]
  → Hub.JoinSession → Session.OnPlayerRejoined
  → loadSnapshot(playerID) → 해당 플레이어 시점 필터
  → WS push → gameSessionStore.hydrate()         ← PR-3+8
```
