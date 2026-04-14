# Phase 18.0 — Execution Model (Wave DAG)

## Wave DAG

```
W0: PR-0 (Phase 17.5 cleanup)                       ← sequential, fullstack
 ↓
W1: PR-1 (WS routing) ║ PR-2 (startModularGame)   ← parallel, backend
 ↓
W2: PR-3 (game store) ║ PR-4 (phase UI)            ← parallel, frontend
 ↓
W3: PR-5 (chat) ║ PR-6 (vote+clue) ║ PR-7 (reading+ending)  ← parallel ×3
 ↓
W4: PR-8 (snapshot + reconnect)                     ← sequential, fullstack
 ↓
W5: PR-9 (E2E integration)                          ← sequential, test
```

## 파일 스코프 (충돌 분석)

### PR-0 (Phase 17.5 cleanup) — fullstack
```
apps/server/internal/domain/editor/types.go (신규)
apps/server/internal/domain/editor/service.go (타입 이동)
apps/server/internal/domain/editor/clue_relation_service.go (타입 이동)
apps/server/internal/domain/editor/clue_relation_service_test.go (신규, testcontainers)
apps/web/src/features/editor/hooks/useClueGraphData.ts (debounce 일원화)
apps/web/src/features/editor/hooks/__tests__/useClueGraphData.test.ts (신규)
apps/web/src/features/editor/api.ts (useDeleteClue invalidation)
apps/web/src/features/editor/validation.ts (Kahn index pointer)
apps/web/e2e/clue-relation.spec.ts (MSW mock)
```
상세: [w0-cleanup.md](./w0-cleanup.md)

### PR-1 (WS routing) — backend
```
apps/server/internal/ws/hub.go (수정: Route dispatch)
apps/server/internal/ws/envelope.go (신규: 타입 레지스트리)
apps/server/internal/ws/hub_test.go
```

### PR-2 (startModularGame) — backend
```
apps/server/internal/session/starter.go (신규)
apps/server/internal/session/starter_test.go
apps/server/internal/engine/factory.go (신규: 모듈 팩토리)
apps/server/internal/handler/room_handler.go (수정: Start 연동)
```

### PR-3 (game store) — frontend
```
apps/web/src/stores/gameSessionStore.ts (신규)
apps/web/src/features/game/hooks/useGameSession.ts
apps/web/src/features/game/hooks/useGameWS.ts
```

### PR-4 (phase UI) — frontend
```
apps/web/src/features/game/components/PhaseBar.tsx
apps/web/src/features/game/components/PhaseTimer.tsx
apps/web/src/features/game/components/GameLayout.tsx
apps/web/src/features/game/pages/GamePage.tsx
```

### PR-5 (chat) — frontend
```
apps/web/src/features/game/components/GameChatPanel.tsx
apps/web/src/features/game/components/WhisperPanel.tsx
```

### PR-6 (vote + clue) — frontend
```
apps/web/src/features/game/components/VotePanel.tsx
apps/web/src/features/game/components/ClueViewPanel.tsx
```

### PR-7 (reading + ending) — frontend
```
apps/web/src/features/game/components/ReadingPanel.tsx
apps/web/src/features/game/components/EndingPanel.tsx
```

### PR-8 (snapshot) — fullstack
```
apps/server/internal/session/snapshot.go (신규)
apps/server/internal/session/snapshot_test.go
apps/web/src/stores/gameSessionStore.ts (hydration 추가)
```

### PR-9 (E2E)
```
apps/web/e2e/game-session.spec.ts (신규)
```

## 충돌 분석

| Pair | 겹침 | 안전 |
|------|------|------|
| PR-0 (editor/) vs W1~W5 (ws/, session/, game/) | 없음 | ✅ |
| PR-1 vs PR-2 | 없음 (ws/ vs session/) | ✅ |
| PR-3 vs PR-4 | 없음 (stores/ vs components/) | ✅ |
| PR-5 vs PR-6 vs PR-7 | 없음 (독립 컴포넌트) | ✅ |

## 모델 오버라이드

| PR | Model | 이유 |
|----|-------|------|
| PR-0 | sonnet | 리팩토링 + 테스트 (반복 패턴) |
| PR-1 | opus | WS 동시성, Actor 패턴 |
| PR-2 | opus | 엔진 초기화, 모듈 팩토리 |
| PR-3 | sonnet | Zustand 패턴 반복 |
| PR-4~7 | sonnet | UI 컴포넌트 |
| PR-8 | opus | 스냅샷 직렬화, 재접속 로직 |
| PR-9 | sonnet | E2E 테스트 |
