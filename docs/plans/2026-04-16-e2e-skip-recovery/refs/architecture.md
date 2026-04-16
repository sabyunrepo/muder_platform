# Phase 18.8 — Architecture

> 부모: [../design.md](../design.md)

---

## 컴포넌트 맵

```
Backend (변경 최소)
  └─ room/service.go
     ├─ CreateRoomRequest { ThemeID, MaxPlayers *int32 (optional), IsPrivate }
     └─ CreateRoom(): nil → theme.MaxPlayers fallback + 범위 재검증

Frontend mocks (신규)
  apps/web/src/mocks/
    ├─ browser.ts          (setupWorker, dev/스토리북 사용 가능)
    ├─ server.ts           (setupServer, Vitest 사용)
    └─ handlers/
        ├─ auth.ts         (POST /v1/auth/login, GET /v1/auth/me)
        ├─ theme.ts        (GET /v1/themes, GET /v1/themes/:id)
        ├─ room.ts         (POST /v1/rooms, GET /v1/rooms/:id)
        ├─ clue.ts         (GET /v1/clues, GET /v1/clue-relations)
        └─ game-ws.ts      (WS payload factory — role별 redacted)

E2E helpers (신규 + 기존 재배치)
  apps/web/e2e/helpers/
    ├─ common.ts           (login, createRoom, createPartyOfN, waitForGamePage)
    ├─ msw-route.ts        (MSW handler → Playwright page.route 어댑터)
    └─ editor-golden-path-fixtures.ts  (기존 유지)

E2E specs (신규)
  apps/web/e2e/
    ├─ game-redaction-stubbed.spec.ts  (신규, MSW+page.route 기반)
    └─ clue-relation-stubbed.spec.ts   (신규, MSW 기반)

CI (트리거 확장)
  .github/workflows/
    ├─ e2e-stubbed.yml                (+ workflow_dispatch)
    └─ phase-18.1-real-backend.yml    (+ push: [main] 관측 모드)
```

---

## 데이터 경로

### HTTP 경로 (MSW 주도)

```
Playwright test
  → page.goto('/login')
  → fetch('/api/v1/auth/login')  ─┐
                                  │
               MSW Service Worker ◂ handlers/auth.ts
                                  │
  ← 200 { accessToken, user } ◂───┘
```

테스트에서는 `page.addInitScript(msw.start)` 또는 어댑터를 통해 `page.route()`로 등록.

### WS 경로 (page.route 주도)

```
Test WS client
  → new WebSocket('ws://.../session')
          │
  Playwright routeWebSocket intercept
          │
  game-ws.ts handler에서 role별 payload 생성:
    • murderer  → { ... role:"murderer", secret_card:{...} }
    • detective → { ... role:"detective", secret_card:"???" }
    • normal    → { ... role:"normal",    secret_card:"???" }
    • whisper   → 수신자 일치 시 전송, 불일치 시 필터
```

---

## MSW handler 책임 경계

| 핸들러 | 담당 | 사용처 |
|--------|------|--------|
| `auth.ts` | 로그인/토큰 갱신/me | stubbed spec 전부 |
| `theme.ts` | 테마 목록/상세 | createRoom 플로우 |
| `room.ts` | 방 생성/조회/join | party helper |
| `clue.ts` | 단서 목록/관계 | `clue-relation-stubbed` |
| `game-ws.ts` | WS payload factory (role-based redaction) | `game-redaction-stubbed` |

**SSOT 원칙**: 응답 shape 변경 시 handler 한 곳만 수정. FE 컴포넌트와 spec이 모두 이 shape을 따름.

---

## party helper 설계

```ts
// apps/web/e2e/helpers/common.ts (개념)
export async function createPartyOfN(
  browser: Browser,
  n: number,
): Promise<{
  host: Page;
  guests: Page[];
  roomId: string;
}> {
  // 1. n개 context 병렬 생성
  // 2. 각 context에서 login (e2e@test.com ~ e2e+3@test.com)
  // 3. host가 createRoom → roomId 반환
  // 4. guests가 join(roomId) 병렬 실행
  // 5. 전원 LobbyRoom 진입 대기 (Promise.all)
}

export async function waitForGamePage(pages: Page[], timeout = 30_000) {
  // 전원 GamePage 진입 동기 대기. 하나라도 실패 시 throw.
}
```

---

## 결정 근거 (요약)

- **왜 MSW를 도입하나**: H6(ThemeCard), H7(MaxPlayers) 둘 다 계약 drift. `page.route()`는 spec마다 분산되어 SSOT 부재. MSW handler를 한 곳에 두면 FE·E2E·Storybook·Vitest 모두 같은 계약 참조.
- **왜 WS는 page.route인가**: MSW v2의 WS 지원은 실험 단계. Playwright 1.48+ `routeWebSocket`이 안정 + role별 redaction 테스트에 충분.
- **왜 혼합인가**: 최대 재사용 + 최소 리스크. HTTP는 SSOT, WS는 안정성 우선.
