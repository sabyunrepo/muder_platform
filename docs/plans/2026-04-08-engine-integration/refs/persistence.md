# State Persistence + Recovery

> 부모: [../design.md](../design.md)

---

## 시나리오 구분 (중요)

| 시나리오 | 빈도 | 복구 대상 | 전략 |
|---------|------|----------|------|
| Client reconnect | 자주 (분당) | 그 클라이언트만 | Replay + Snapshot push |
| Server restart | 드물게 (배포) | 모든 active session | Lazy Restore from Redis |

이 둘은 데이터 흐름이 완전히 다르므로 따로 설계.

---

## Client Reconnect (하이브리드)

### A. 짧은 단절 (<60s): ReconnectBuffer Replay

이미 `ws.Hub`에 `ReconnectBuffer`(60초, 1000개 메시지) 구현됨. 그대로 활용.

```
Client B 재접속 → lastSeq 전송 → Hub가 buffer에서 그 이후 메시지 replay
```

- 추가 작업 0
- 짧은 단절(와이파이 깜빡)은 저비용으로 복구

### B. 긴 단절 (≥60s): Snapshot Push

Buffer가 이미 지나갔으면 full state snapshot을 클라이언트에게 push.

```
Client B 재접속 → SessionManager.OnPlayerRejoined → Session.Inbox
→ Session이 모든 active 모듈의 snapshot 1개 envelope 생성
→ client B에게만 send (broadcast 아님)
```

각 모듈의 `BuildState()` 이미 구현됨 (engine.Module 인터페이스). 그 결과를 envelope으로 감싸서 push.

---

## Server Restart

### 5초 Throttle + Critical 즉시 write

**Throttle 알고리즘**:
```go
func (s *Session) maybeSnapshot() {
    if s.dirtySince.IsZero() { return }            // dirty 없음
    if time.Since(s.lastSnapshotAt) < 5*time.Second { return }  // throttle
    s.persistSnapshot(force: false)
    s.lastSnapshotAt = time.Now()
    s.dirtySince = time.Time{}
}

func (s *Session) markDirty() {
    if s.dirtySince.IsZero() {
        s.dirtySince = time.Now()
    }
}
```

**Critical 이벤트는 즉시 force write** (throttle 무시):
- Phase 전환 (enterCurrentPhase 직후)
- 모듈 init / cleanup
- Ending 모듈 활성화

Critical은 `SessionMessage{Kind: KindCriticalSnapshot}`으로 self-send → 같은 actor 안에서 처리되어 race 없음.

**왜 디바운스가 아니라 throttle?**
- 디바운스: 5초 동안 변경 없으면 write → 끊임없이 변경되면 영원히 write 안 됨
- Throttle: 최대 5초 손실 보장 → 데이터 안전성 ↑

---

## 직렬화 대상

### 필수 (반드시 복구)
- engine state: `currentPhase`, `started`, `configHash`
- 모든 active 모듈: `BuildState()` 결과
- 세션 메타: sessionID, roomID, players[], host, themeID
- 페이즈 타이머: `phaseEnteredAt`, `phaseDeadline`

### 제외 (복구 안 함)
- WS conn: 클라이언트가 다시 연결
- LiveKit room: 새로 생성
- transient EventBus subscriptions: 새 goroutine이 re-subscribe

---

## Redis Key 구조

```
session:{sessionID}:meta        JSON: {roomID, host, players[], themeID, configHash, startedAt, lastActiveAt}
session:{sessionID}:engine      JSON: {currentPhase, phaseEnteredAt, phaseDeadline, started, schemaVersion}
session:{sessionID}:module:{n}  JSON: 모듈별 BuildState() 결과
TTL: 24h on all keys, refreshed on each write
```

**schemaVersion**: 스냅샷 포맷 버전. 복구 시 mismatch면 해당 session 손실 처리 + 운영 알람. v3.0 → v3.1 업그레이드 시 마이그레이션 경로 확보.

---

## Lazy Restore

```go
func (m *SessionManager) Restore(ctx, sessionID) (*Session, error) {
    // 1. Redis meta 조회 (없으면 nil)
    meta := redis.Get("session:" + sessionID + ":meta")
    if meta == nil { return nil, nil }

    // 2. engine state, 모든 module state 조회 (MGET 권장)
    engineState := redis.Get(...)
    moduleStates := map[string]json.RawMessage{}

    // 3. theme configJson 재로딩 (DB에서 — config는 immutable)
    configJSON := loadConfigByThemeID(meta.themeID)

    // 4. Session 재구성
    sess := NewSession(sessionID, meta.roomID, ...)
    go sess.Run(ctx)

    // 5. engine 재시작 + state 복원
    sess.engine = engine.NewEngine(sessionID, logger)
    sess.engine.Start(ctx, configJSON)         // 모듈 Init 호출됨
    sess.engine.RestoreEngineState(engineState) // currentPhase 복원
    for name, state := range moduleStates {
        sess.engine.RestoreModuleState(name, state)
    }

    // 6. 매핑 재구독
    sess.subscribeMappings()

    // 7. Manager에 등록
    m.mu.Lock()
    m.sessions[sessionID] = sess
    m.mu.Unlock()

    return sess, nil
}
```

### engine 인터페이스 확장 필요

- `(*GameProgressionEngine).RestoreEngineState(state json.RawMessage) error`
- `(*GameProgressionEngine).RestoreModuleState(name string, state json.RawMessage) error`
- `(engine.Module) RestoreState(state json.RawMessage) error` (옵셔널, default no-op)

각 모듈의 `BuildState` ↔ `RestoreState`는 1:1 대응. PR-7에서 ReadingModule부터 구현.

---

## 복구 흐름 (Lazy — 자동 스캔 안 함)

**Lazy 선택 이유**:
- 시작 시 KEYS/SCAN 스캔은 prod에서 위험
- 필요한 세션만 복구 → 메모리 절약
- 좀비 세션 (배포 직전 끝난 세션)은 자연스럽게 GC (TTL + lazy miss)

```
[서버 재시작]
  │ (모든 active session이 메모리에서 사라짐)
  │
[Client A 재접속 시도]
  ├→ WS /ws/game?sessionId=X
  ├→ Hub.JoinSession(c, X)
  ├→ SessionManager.Get(X) → nil
  ├→ SessionManager.Restore(ctx, X)
  │    ├ Redis meta 조회
  │    ├ 있음: Session 재구성 + 반환
  │    └ 없음: nil (client에 "session not active" 에러)
  ├→ Session 복원 완료
  └→ snapshot push to client A
```
