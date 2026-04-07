# 데이터 흐름

> 부모: [../design.md](../design.md)

---

## 1. 게임 시작 흐름

```
[Host Client]                 [Server]                     [SessionManager]
  │                              │                              │
  ├─ POST /api/v1/rooms/{id}/start ─→                           │
  │                              │ ├─ validate host             │
  │                              │ ├─ check all players ready   │
  │                              │ ├─ load theme.configJson     │
  │                              │ │                             │
  │                              ├─ Start(roomID, config) ────→ │
  │                              │                              │
  │                              │        ┌─────────────────────┘
  │                              │        │ NewSession(...)
  │                              │        │ go session.Run(ctx)
  │                              │        │ engine.Start(ctx, config)
  │                              │        │ subscribeMappings()
  │                              │        │ persistSnapshot(initial)
  │                              │        │
  │                              │        ↓ sessionID
  │                              │ ←──────
  │                              │
  │                              ├─ Room.sessionID = sessionID (DB)
  │                              ├─ broadcast: {type: "session:started", sessionId}
  │ ←─ session:started ──────────│
[All Clients]                    │
  │                              │
  ├─ WS /ws/game?sessionId ─────→│
  │                              ├─ Hub.JoinSession(client, sessionID)
  │                              │   → notifyPlayerRejoined (reconnect 시)
  │                              │   → snapshot push (클라이언트별)
```

---

## 2. In-game 메시지 흐름 (reading:advance 예시)

```
[Client A]           [Hub]           [ReadingHandler]    [Session goroutine]
   │                   │                    │                   │
   ├ {reading:advance}→│                    │                   │
   │                   ├ Route(c, env) ────→│                   │
   │                   │                    ├ WithSession(...)  │
   │                   │                    │                   │
   │                   │                    ├ inbox <- msg ───→ │
   │                   │                    │                   │
   │                   │                    │                   ├ engine.modules["reading"]
   │                   │                    │                   │   .HandleAdvance(playerID,
   │                   │                    │                   │                   isHost,
   │                   │                    │                   │                   roleID)
   │                   │                    │                   │ → 권한 검증
   │                   │                    │                   │ → currentLineIndex++
   │                   │                    │                   │ → eventBus.Publish(
   │                   │                    │                   │     "reading.line_changed")
   │                   │                    │                   │
   │                   │                    │                   ├ EventMapping subscriber
   │                   │                    │                   │ → wire envelope
   │                   │                    │                   │ → hub.BroadcastToSession
   │ ←─ {reading:line_changed} ──────────────┤                   │
   │                   │                    │                   │
   │                   │                    ├ reply ←──────── ──│ (nil = success)
   │                   │                    │                   │
   │                   │ ←─ 통과 ───────────│                   │
```

**성질**: 한 메시지 처리 = 결정적 순서, lock 0개, race 0개.

---

## 3. Disconnect / Reconnect 흐름

### Disconnect (Client B 끊김)

```
[Client B 끊김]
   │
   ├→ ws.Hub.run() unregister → removeClientLocked(c)
   │                             notifyPlayerLeft(c)
   │                                  │
   │                                  ↓
   │                             SessionManager.OnPlayerLeft(sessionID, playerID)
   │                                  │
   │                                  ↓
   │                             session.Inbox <- {Kind: KindLifecycleLeft, PlayerID}
   │                                  │
   │                                  ↓ (session goroutine 안에서)
   │                             reading 모듈에 HandlePlayerLeft 호출
   │                             → 호스트면 status=paused
   │                             → eventBus.Publish("reading.paused")
   │                             → 매핑 → reading:paused broadcast
```

### Reconnect (Client B 재접속)

```
[Client B 재접속 with same playerID]
   │
   ├→ ws.Hub.JoinSession(c, sessionID)
   │                             notifyPlayerRejoined(c)
   │                                  │
   │                                  ↓
   │                             SessionManager.OnPlayerRejoined
   │                                  │
   │                                  ↓
   │                             Session.Inbox <- {Kind: KindLifecycleRejoined}
   │                                  │
   │                                  ↓ (session goroutine 안에서)
   │                             reading 모듈에 HandlePlayerRejoined 호출
   │                             → status=playing
   │                             → eventBus.Publish("reading.resumed")
   │                             + 클라이언트 B에게만 snapshot push
   │                               (다른 클라이언트들은 reading:resumed 이벤트만 받음)
```

---

## 4. Phase 전환 흐름

```
[타이머 만료 또는 합의 도달 또는 GM 오버라이드]
   │
   ↓ Session.Inbox <- {Kind: KindTimer/Consensus/GM}
   │
   ↓ handleMessage → engine.Advance(ctx) or engine.GMOverride(...)
   │
   ↓ engine 내부:
   │   ├ exitCurrentPhase (onExit actions via ActionDispatcher)
   │   ├ strategy.Advance / SkipTo
   │   └ enterCurrentPhase (onEnter actions)
   │
   ↓ eventBus.Publish("phase:changed", newPhaseInfo)
   │
   ↓ EventMapping → Hub.BroadcastToSession("phase:changed" → "phase:changed")
   │
   ↓ 즉시 Critical Snapshot (phase 전환은 critical 이벤트)
   │   self Inbox <- {Kind: KindCriticalSnapshot}
   │
   ↓ persistSnapshot(force=true) → Redis write
```

Phase 전환은 5초 throttle 무시하고 즉시 Redis에 write. 재시작 복구 시 phase 손실 방지.
