# 06 perf-observability — Phase 19 감사 W2 Specialists

## Scope

성능·관측성 평면: sqlc 쿼리 N+1, EventBus `SubscribeAll`+prefix 필터 fan-out 비용, zerolog 신호대잡음비·필드 크기, OTel 훅 위치(transaction·WS·asynq 경계), pprof endpoint 존재·보호, asynq 큐 타임아웃·재시도, goroutine 누수·context 전파, WebSocket 브로드캐스트 O(N), Frontend 번들 스플리팅 실효성·Zustand selector·React.memo/useCallback·이미지 lazy.

**금지**: 계층 경계(01), 파일 크기 리밋(01), 보안(05), WCAG(07).

## Method

- **Backend (Go)**: `apps/server/internal/{infra,ws,engine,db}/**` 정적 분석. cmd/server main.go, OTel/Sentry 초기화, EventBus 구조, WS 브로드캐스트 패턴.
- **Frontend (React/TS)**: `apps/web/src/{stores,pages,features}/**` Zustand selector, lazy routing, 메모이제이션, 이미지 로딩.
- **근거**: file:line 명시, test-baseline.md 0% 패키지 인용.

## Findings

### F-perf-1: 관측 레이어(OTel·Sentry·Storage) 0% 테스트 커버리지 + wiring 검증 부재

- **Severity**: P0
- **Evidence**: `test-baseline.md §1.2`; `apps/server/internal/infra/otel/otel.go`, `infra/sentry/sentry.go`, `infra/storage/*.go` 각각 `[no test files]`. cmd/server main.go:99-111에서 OTel/Sentry 초기화 성공/실패 경로 모두 실행되지 않음.
- **Impact**: OTel endpoint 오타(cfg.OTelEndpoint 빈 문자열) 시 init 함수가 no-op cleanup 반환 — 성능 metric 누락되지만 silent failure. Sentry DSN 누락 시 error logger.Warn만 출력(운영 추적 불가). Storage provider wiring(R2 vs local)이 config-driven이나 실패 케이스 없음.
- **Proposal**: OTel/Sentry 초기화 테스트 추가 — endpoint/DSN 누락, endpoint 응답 실패, exporter shutdown timeout 시나리오. Storage provider 단위 테스트(R2 auth 실패, local write permission).
- **Cross-refs**: [cross:04-test]

### F-perf-2: EventBus `SubscribeAll` wildcard handler fan-out — O(N) 브로드캐스트 + 필터링 없음

- **Severity**: P1
- **Evidence**: `apps/server/internal/engine/eventbus.go:65-76` (SubscribeAll). `apps/server/cmd/server/main.go:209-213` (eventbus subscriptions — 현재 4개 named type). eventbus_test.go에서 SubscribeAll 테스트 존재하나, 수백 개의 세션이 동시 실행될 때 wildcard 핸들러는 모든 이벤트(내부 engine event 포함)를 받음. Publish 루프(eventbus.go:113-127)는 복사 후 invoke — 각 wildcard 호출 비용 누적.
- **Impact**: 수신자 수 N이 커질수록 O(N) 비용. 각 이벤트마다 wildcard 핸들러 리스트 전체 순회. named subscription도 동시 호출되므로 총 호출 수 = (type-specific entries + wildcard entries) × event frequency. 명확한 subscription 구조로 topic 분할 기회 있음.
- **Proposal**: SubscribeAll 사용처 감시 — module eventmapping에서 prefix filter (e.g., "module:*") 도입 검토. 필터링을 subscribe 단계에서 handler 내부가 아닌 publish 판단 지점으로 이동. 예시: `SubscribePrefix(prefix, handler)` variant.
- **Cross-refs**: [cross:09-ws-contract]

### F-perf-3: WebSocket 브로드캐스트 O(N) 순회 + 세션 버퍼 모든 클라이언트 대상 기록

- **Severity**: P1
- **Evidence**: `apps/server/internal/ws/hub.go:322-352` (broadcastToSession). 세션 클라이언트 맵을 RLock 아래서 슬라이스로 복사(line 334-336), 버퍼에 1회 push(line 342-344), 모든 N명에게 SendMessage 루프(line 346-351). 최대 플레이어 수 제약 없음(config.MaxPlayers는 방 단위, hub 전체가 아님).
- **Impact**: 세션당 브로드캐스트는 O(N) — 100명 세션이면 100개의 SendMessage 호출(각 chan send). 메모리: reconnectBuffer는 세션당 1000개 메시지 저장(line 27) — 100개 세션 = 100MB 메모리. WebSocket upgrade(line 310-315)에 rate limit 없음.
- **Proposal**: 세션 크기 제한 추가(e.g., maxPlayersPerSession = 20). 장문 메시지는 별도 buffered channel로 배압 처리. reconnectBuffer 메모리 예산 모니터링(pprof heap). Backpressure test case 추가.
- **Cross-refs**: none

### F-perf-4: pprof endpoint 미등록 — production 성능 분석 불가

- **Severity**: P2
- **Evidence**: cmd/server main.go에서 net/http/pprof import 없음. chi router에 `/debug/pprof` 마운트 없음. Bash grep `pprof` 0건.
- **Impact**: 프로덕션 환경에서 goroutine leak, heap 증가, CPU 프로파일 수집 불가. 장애 발생 시 근본원인 분석 지연.
- **Proposal**: main.go에서 `import _ "net/http/pprof"` + `pprof.Index` 등을 chi 라우터에 등록 또는 별도 mux에 마운트. `/debug/pprof/*` 경로는 admin-only middleware 추가.
- **Cross-refs**: [cross:05-security] (access control)

### F-perf-5: zerolog 필드 크기 제약 없음 — 전체 payload 로깅 위험

- **Severity**: P1
- **Evidence**: `apps/server/internal/infra/storage/local.go`, `r2.go`에서 `l.log.Debug()` 호출 시 필드 추가(e.g., key, content_type, batch_size). 하지만 domain service, engine, session, ws에서 전체 구조체를 로깅하는 패턴 없음을 확인. 하지만 **auditlog logger(logger_test.go, logger.go)는 테스트 존재**. zerolog 기본 구성(cmd/server main.go:59-77)에서 필드 크기 제약 없음(no MaxFieldSize). 대규모 스냅샷 또는 phase state를 로깅하면 로그 라인이 수KB 가능.
- **Impact**: 로그 저장소 용량 초과, 수집 시스템(Sentry, 로그 집계) 부하. sensitive data(token, PII) 노출 위험 낮으나, 신호대잡음비 악화.
- **Proposal**: zerolog 구성에 필드 제약 추가 (e.g., 최대 1KB per field). 큰 구조체는 `.RawJSON("state", json.Marshal(...))` 대신 hash/checksum만 로깅. audit log는 제외.
- **Cross-refs**: [cross:05-security]

### F-perf-6: OTel 샘플 레이트 0.1 hardcoded — production tracing 과소

- **Severity**: P2
- **Evidence**: `apps/server/internal/infra/otel/otel.go:54-58`. SampleRate default 0.1 (10%). cmd/server main.go:105에서 cfg.SampleRate 미사용(hardcoded 0.1로 override 되지 않음).
- **Impact**: 10%의 trace만 수집 — tail latency, rare edge case 이벤트 누락. 성능 분석 신뢰도 낮음.
- **Proposal**: cfg.OTelSampleRate config 추가, env OTEL_SAMPLE_RATE 읽기. Production: 0.1(비용 제어), Staging: 1.0(전체 추적).
- **Cross-refs**: none

### F-perf-7: Frontend Zustand store selector 사용 미점검 — 전체 구독 가능성

- **Severity**: P2
- **Evidence**: `apps/web/src/stores/connectionStore.ts:40-142`, `gameSessionStore.ts:68-142`, `uiStore.ts:23-51`. Zustand create 기본 구조에서 selector 예시(connectionStore.ts:135-141) 정의. useConnectionStore, useGameSessionStore 호출 시 selector 전달 여부 미확인(Bash에서 실제 컴포넌트 import 스캔 필요). connectionStore, gameSessionStore 모두 gameClient/socialClient WsClient 인스턴스 포함 — 게임 상태 변경 시마다 리렌더 가능.
- **Impact**: selector 생략 시 전체 state 구독 → store 내 한 필드만 변경되어도 모든 컴포넌트 리렌더. Phase transition 이벤트(자주 발생)마다 전체 게임 상태 가입자들 리렌더.
- **Proposal**: Zustand selector 사용 감시 — Game, Lobby, Editor 주요 컴포넌트에서 selectXXX 선택자로 필드별 구독 강제. 메모이제이션 추가(connectionStore의 gameClient 변경 == 재접속일 때만 리렌더).
- **Cross-refs**: [cross:02-react-frontend]

### F-perf-8: Frontend lazy() routing 실효성 미확인 — 번들 스플리팅 coverage

- **Severity**: P2
- **Evidence**: `apps/web/src/pages/GamePage.tsx` lazy 적용 grep 1건. App.tsx에 Suspense/dynamic import 있는지 미확인(해당 파일 읽음 필요).
- **Impact**: 주요 페이지(GamePage, EditorPage, LobbyPage)가 초기 번들에 포함되면 LCP 지연. 현재 lazy coverage unknown.
- **Proposal**: `pnpm vite-plugin-visualizer build` 실행 → 번들 구성 분석. 페이지별 lazy split 적용 여부 확인. Editor는 큰 라이브러리(Cytoscape, flow-editor) 포함 → 가장 효과 큼.
- **Cross-refs**: [cross:02-react-frontend]

### F-perf-9: Frontend 이미지 lazy loading + decoding hint 미적용

- **Severity**: P2
- **Evidence**: Grep `loading|decoding|lazy` 12건 파일 검출(ThemeCard, GameHUD, ReadingPanel, AvatarPresetGrid, MediaCard 등). 파일 내용 미읽음(예시: MediaCard, AvatarPresetGrid 구체 분석 필요). 표준 HTML5 `<img loading="lazy" decoding="async">` 적용 여부 불명.
- **Impact**: 초기 페이지 로드 시 화면 밖의 모든 이미지 다운로드 — LCP 지연, 네트워크 대역폭 낭비.
- **Proposal**: 주요 이미지 컴포넌트(Avatar, ThemeCard, MediaCard, CharacterImage)에서 loading="lazy", decoding="async" 명시. picture + srcset로 반응형 최적화. Next.js Image 컴포넌트 검토(현재 vite 환경).
- **Cross-refs**: [cross:02-react-frontend]

### F-perf-10: goroutine leak 포인트 — context cancel 전파 미점검

- **Severity**: P1
- **Evidence**: `apps/server/internal/session/session.go:1-80` (actor model inbox). `apps/server/internal/ws/hub.go:111-147` (event loop), `notifyPlayerLeft:551-578`, `notifyPlayerRejoined:583-610`. hub.notifyPlayerLeft/Rejoined에서 `go func()` goroutine 생성(line 559, 591) — 리스너 호출 비동기. 리스너 panic recovery 있음(line 560-572). 하지만 **context cancel 전파 없음** — 리스너가 select{<-ctx.Done()}를 기다리면 timeout 없음.
- **Impact**: 느린 lifecycle listener가 처리 중 메시지 수집 후 메모리 누수. 세션 종료 후 리스너 goroutine이 계속 실행. cmd/server에서 shutdown 신호(os.Signal, context.Background) 없음 — graceful shutdown 경로 미점검.
- **Proposal**: notifyPlayerLeft/Rejoined에 ctx parameter 추가(timeout context). hub.Stop() 호출 시 graceful context cancel 수행. cmd/server main에서 sigterm/sigint handler + context.WithTimeout(background, 30s) 추가.
- **Cross-refs**: none

## Metrics

| 메트릭 | 값 | 판단 |
|--------|-----|------|
| 관측 패키지 0% 커버리지 | 3 (`cmd/server`, `infra/otel`, `infra/sentry`, `infra/storage`) | P0 seed |
| EventBus wildcard entries (현재) | 1 (eventmapping) | 낮으나 확장성 위험 |
| pprof endpoint | 0 (미등록) | P2 |
| Frontend lazy page count | TBD (pnpm vite-plugin-visualizer 필요) | 측정 필요 |
| zerolog field size limit | none (hardcoded 무제한) | P1 |

## Advisor-Ask

1. **OTel wiring 검증 전략**: [05-security] 리뷰 후, cmd/server init 성공/실패 경로가 test-engineer에서 커버되어야 하는지 확인. 관측 레이어 mocking 방식?
2. **EventBus prefix filter 우선순위**: go-backend-engineer 의견 — wildcard → 명시적 subscription으로 마이그레이션 비용 vs 성능 이득 trade-off.
3. **Frontend lazy routing measurement**: react-frontend-engineer의 current bundle analysis 공유 — pnpm vite-plugin-visualizer 결과 + page별 entry point.

## 정적 관찰 한계

- **실행 환경 부하**: 수백 세션 동시 접속 시 실제 goroutine 누수, heap 증가는 pprof로만 확인 가능. 현재 분석은 코드 구조에 기반.
- **Frontend rendering performance**: React DevTools Profiler 없이 selector 미사용 시 실제 리렌더 횟수 미측정.
- **이미지 로딩 성제**: 실제 LCP, CLS는 field data(RUM) 또는 Lighthouse 필요. 코드에서는 로딩 속성 존재 여부만 확인 가능.
- **OTel/Sentry 정상 동작**: 초기화 코드는 있으나, production에서 실제 event 송출, retention policy 준수는 dashboard 확인 필요.
