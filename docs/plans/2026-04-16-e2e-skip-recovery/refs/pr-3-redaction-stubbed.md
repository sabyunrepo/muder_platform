# PR-3 — test(e2e): game-redaction stubbed 복제본

> 부모: [../plan.md](../plan.md)
> Wave: 2 (parallel) | 의존: PR-1, PR-2 | 브랜치: `test/e2e-redaction-stubbed`

---

## 목적

`game-redaction.spec.ts`는 `PLAYWRIGHT_BACKEND` env gate로 stubbed CI에서 전체 skip. 본질은 "role에 따라 서버 payload에서 민감 정보가 가려지는지"로, 이는 FE 렌더링 로직 검증 → MSW HTTP + Playwright WS route 조합으로 재현 가능. 실제 backend 없이 stubbed CI에서 pass하는 복제본 spec 신규.

---

## Scope

```yaml
scope_globs:
  - apps/web/e2e/game-redaction-stubbed.spec.ts
  - apps/web/src/mocks/handlers/game-ws.ts
  - apps/web/src/mocks/handlers/index.ts
```

---

## Tasks

### Task 1 — game-ws handler factory
- `handlers/game-ws.ts`:
  ```ts
  export function createGameWsRoute(role: "murderer"|"detective"|"normal")
  export function createWhisperRoute(senderId: string, receiverId: string)
  ```
- Role별 payload 4종:
  - `normal`: `secret_card: "???"`, 역할 카드 일반
  - `murderer`: `secret_card: {...full...}`, 역할 카드에 범인 정보
  - `detective`: `secret_card: "???"`, 탐정 전용 단서 표시
  - `whisper`: sender/receiver 매칭 시에만 DOM 출현

### Task 2 — game-redaction-stubbed.spec.ts
- 구조는 `game-redaction.spec.ts` 참조
- `test.beforeEach`에서 `installMswRoutes(page, [auth, theme, room])` + `page.routeWebSocket` 등록
- 4 시나리오 전부 stubbed에서 수행:
  1. 범인 역할 payload 검증 — `secret_card.contents` 실제 값 노출
  2. 일반/탐정 역할 payload 검증 — `"???"` 마스킹
  3. whisper 수신자 매칭 — DOM 노출
  4. whisper 수신자 비매칭 — DOM 미노출

### Task 3 — 기존 spec 주석 연동
- `game-redaction.spec.ts` 파일 최상단에 코멘트:
  ```
  // Stubbed 복제본: game-redaction-stubbed.spec.ts
  // 이 spec은 PLAYWRIGHT_BACKEND 환경에서만 실행. stubbed CI는 복제본으로 검증.
  ```

### Task 4 — after_task pipeline
- `pnpm --filter @mmp/web test:e2e game-redaction-stubbed` 로컬 pass
- stubbed CI에서 4 시나리오 pass 확인
- `game-redaction-stubbed.spec.ts` 250줄 이내 (helper 활용으로)

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `game-redaction.spec.ts` | 시나리오 원본 참조 |
| `handlers/game-ws.ts` (PR-2에서 shell 생성) | role factory 구현 |
| `common.ts:createPartyOfN` | 4인 컨텍스트 구성 (수신자 ID 부여용) |
| Playwright `page.routeWebSocket` (1.48+) | WS intercept |

---

## 검증

- 로컬: `pnpm test:e2e game-redaction-stubbed` 4/4 pass
- CI: `e2e-stubbed.yml` 실행 시 4 시나리오 pass
- 기존 `game-redaction.spec.ts`는 여전히 nightly에서 real backend로 실행

---

## 리뷰 포인트

- `routeWebSocket` 패턴 정확성 (Playwright 버전 체크)
- role 매핑 로직이 서버 실제 redaction과 일치 (drift 방지 — `snapshot redaction` 스펙 참조)
- flaky 위험: WS 연결 타이밍 → `page.waitForEvent("websocket")` + route 먼저 설치
