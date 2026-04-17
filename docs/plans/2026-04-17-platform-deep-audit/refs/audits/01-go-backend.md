# 01 — Go Backend Audit

> Executor: go-backend-engineer · Phase 19 W2 Specialists.
> 관점(primary): Handler → Service(interface) → Repository/Provider 계층 경계, AppError + RFC 9457 일관성, DI 생성자 주입, 파일 500줄 / 함수 80줄 한도.
> Hint 경로: `apps/server/internal/**` 전계층. WS 스키마(09), 보안(05), 성능(06), 모듈 내부(03), 테스트(04) 이슈는 `[cross:...]` 태그만 남기고 본인 분석 제외.

## Scope
- Handler (30+ 파일) → Service(인터페이스) → Repository/Provider 경계 준수 여부
- `apperror` + RFC 9457 Problem Details 경로 일관성 (`apperror.WriteError` vs `http.Error`)
- 수동 작성 프로덕션 `.go` 파일/함수 크기 한도 (baseline.md 15 파일 중 sqlc gen 5 제외 → 10 건)
- `context.Context` 전파 무결성 (non-test `context.Background()` · goroutine 내 ctx 단절)
- 로깅 일관성 (`zerolog` 전용, `log.Printf` / `fmt.Println` 잔재)
- DI 패턴 (수동 생성자, 전역 싱글턴/`init` 사이드이펙트)

## Method
- `wc -l` baseline 확인 + `grep -n '^func '` 으로 함수 경계 추출 → end-start 차로 80줄 초과 식별 (table-driven 데이터 없음 확인 후 계산).
- `rg 'http\.Error\('` · `rg 'log\.(Printf|Println)'` · `rg 'fmt\.Println'` · `rg 'context\.Background\(\)'` 로 패턴 스캔.
- `apperror` vs raw `errors.New` / `fmt.Errorf` 분포 집계 (각 파일별 count).
- 30+ handler 파일에서 `*db.Queries` / `*pgxpool.Pool` 필드 존재 여부 → handler의 Repository 직접 접근 탐지 (0 건 확인).
- `apps/server/internal/apperror/handler.go` 실제 읽어 Problem Details 응답 구조 확인.
- 샘플 대상 파일: `ws/hub.go`, `domain/editor/media_service.go`, `domain/coin/service.go`, `domain/room/service.go`, `domain/social/service.go`, `module/progression/reading.go`, `module/decision/voting.go`, `module/decision/accusation.go`, `module/cluedist/trade_clue.go`, `seo/handler.go`, `ws/upgrade.go`, `infra/storage/local.go`, `httputil/json.go`.

## Findings

### F-go-1: `http.Error` 로 RFC 9457 우회 — `seo/handler.go` · `infra/storage/local.go` · `ws/upgrade.go`
- Severity: **P1** (경계: P0 후보 — SEO 페이지는 공개 경로, prod 노출 중)
- Evidence:
  - `apps/server/internal/seo/handler.go:121,136,151` — `ThemePage` / `PrivacyPage` / `TermsPage` 에서 내부 에러를 `http.Error(w, "Internal Server Error", 500)` 으로 리턴. `apperror.WriteError` 미경유 → Problem Details · `code` · `trace_id` · Sentry capture 파이프라인 우회.
  - `apps/server/internal/infra/storage/local.go:118,133,143,149,156,164,184,194` — dev 스토리지 핸들러 8곳. `method not allowed` / `missing key` / `invalid path` / `internal error` 문자열 그대로.
  - `apps/server/internal/ws/upgrade.go:116` — WS upgrade 실패 시 `http.Error(w, "unauthorized", 401)` 로 짧게 종료. 정상 경로지만 다른 HTTP 에러와 포맷 불일치 ([cross:09] WS 토큰 인증).
- Impact: severity-rubric P0 시드 — "`http.Error`로 내부 에러 메시지 노출"은 prod에서 P0. 지금은 detail을 `Internal Server Error` 고정이라 데이터 누출 없음 → P1. `apperror.WriteError`는 5xx detail 마스킹·trace_id·Sentry 자동 처리를 제공하는데 해당 경로들은 전부 놓치는 중.
- Proposal:
  1. SEO 핸들러 3건은 `apperror.Internal("failed to render SEO page")` 반환 + `apperror.WriteError` 호출로 통일. 템플릿 실행 전 Content-Type 세팅 순서 주의 (WriteHeader 이후 set 불가 → body builder 사용).
  2. `infra/storage/local.go` 는 dev-only 경로지만 `apperror.BadRequest` / `apperror.Internal` 로 전환 (sqlc gen 아님, 8 곳 모두 수동).
  3. `ws/upgrade.go` 는 WS pre-upgrade 이므로 `http.Error` 유지 가능. 단, `apperror.New(apperror.ErrUnauthorized, ...).Title` 을 response body에 json로 실어 REST 에러와 포맷 맞춘 변형 검토 [cross:05].
- Cross-refs: [cross:05] (auth error 경로 통일), [cross:09] (WS upgrade 에러).

### F-go-2: `domain/social/service.go` 759줄 · 2개 서비스 인터페이스 혼재
- Severity: **P1**
- Evidence: `apps/server/internal/domain/social/service.go` L1-759. 상단 `FriendService` 인터페이스(9 메서드, L31-41) + `ChatService` 인터페이스(8 메서드, L43-53) 가 한 파일에 공존. 구현체도 `friendService`(L56) · `chatService`(L334 이후) 두 개. 파일 총 23개 메서드.
- Impact: baseline.md 기준 500줄 초과 수동 파일 1호(사이즈 1위). 두 도메인을 같은 패키지에 두면 추가 서비스(presence 등) 편입 시 단일 파일 900+ 예상, SOLID S 위반. 병합 conflict 빈발 위험.
- Proposal: `internal/domain/social/` 하위 분할
  - `friend_service.go` (인터페이스+구현 L30-336, 약 300줄)
  - `chat_service.go` (인터페이스+구현 L338-753, 약 420줄)
  - `errors.go` · `dto.go` 공통 (기존 소스 참고)
  - 각 서비스 생성자 `NewFriendService` · `NewChatService` 그대로 노출. DTO·validMessageTypes 맵은 `types.go` 이전.
- Cross-refs: [cross:03] 모듈이 아닌 domain 서비스라 module-architect 범위 아님. 분할만 제안.

### F-go-3: editor / ws / module 500줄 초과 7건 (수동) — 리팩터 부채 누적
- Severity: **P1** (severity-rubric "한 Phase에 10 개 이상 → P1" 근거. baseline 수동 초과 10 건)
- Evidence (baseline.md §1, sqlc gen 5 제외 후 수동 10건 중 social/service.go 제외한 잔여 9건 가운데 핵심 7건):
  - `apps/server/internal/domain/editor/media_service.go` 653
  - `apps/server/internal/ws/hub.go` 649
  - `apps/server/internal/module/progression/reading.go` 642
  - `apps/server/internal/module/decision/voting.go` 638
  - `apps/server/internal/domain/editor/handler.go` 576 (`^func (h *Handler)` 26 개 엔드포인트)
  - `apps/server/internal/module/decision/hidden_mission.go` 558
  - `apps/server/internal/domain/coin/service.go` 546
- Impact: CLAUDE.md 하드 리밋 위반. handler.go 26 엔드포인트 → 라우팅 도메인(`theme`, `character`, `map`, `location`, `clue`, `content`, `validate`, `module_schema`) 혼재. `ws/hub.go` 는 lifecycle listener · broadcast · reconnect GC 로직이 섞여 추가 feature 투입 시 800+ 예상. 변경 시 테스트 리팩터 비용도 동반.
- Proposal:
  1. `editor/handler.go` → handler_theme.go / handler_character.go / handler_map_location.go / handler_clue.go / handler_content.go 로 분할 (각 ~100-150줄). 라우트 등록은 기존 `Register(r chi.Router, h *Handler)` 유지.
  2. `editor/media_service.go` → media_service.go(core), media_upload.go(RequestUpload · ConfirmUpload · validateAudioMagicBytes), media_youtube.go(CreateYouTube · parseYouTubeVideoID · fetchYouTubeOEmbed) 3 파일.
  3. `ws/hub.go` → hub.go(core+register/unregister), hub_broadcast.go(Broadcast · Route), hub_reconnect.go(recentLeftAt · gc · isReconnect), hub_lifecycle.go(listeners + notify goroutines). run loop 은 hub.go 유지.
  4. `module/**` 4건(`reading`, `voting`, `hidden_mission`, `accusation`, `trade_clue`)은 모듈 카테고리 상위에서 일괄 정책 검토 필요 → [cross:03] module-architect 에 위임.
- Cross-refs: [cross:03] 모듈 4건, [cross:04] 파일 분할 시 기존 테스트 import 경로 변동 시 대응.

### F-go-4: 함수 80줄 초과 6건 동시 누적 — `coin/PurchaseTheme` 156줄 · `RefundTheme` 115줄 · `accusation.handleAccusationVote` 101줄 · `editor/RequestUpload` 89줄 · `editor/ConfirmUpload` 85줄 · `room/CreateRoom` 83줄
- Severity: **P1** (severity-rubric 경계표 "단일 파일 한도 초과 · 같은 Phase 3 개 이상 동시 → P1". 함수 한도 역시 동일 원칙 적용: 6건 누적 → 리팩터 부채 P1)
- Evidence:
  - `apps/server/internal/domain/coin/service.go:129-285` → `PurchaseTheme` 156줄 — tx begin → idempotency check → theme select → user balance guard → ledger write → commit → event publish 전 단계 한 함수.
  - `apps/server/internal/domain/coin/service.go:286-401` → `RefundTheme` 115줄.
  - `apps/server/internal/module/decision/accusation.go:164-264` → `handleAccusationVote` 101줄.
  - `apps/server/internal/domain/editor/media_service.go:135-224` → `RequestUpload` 89줄, `:225-309` → `ConfirmUpload` 85줄.
  - `apps/server/internal/domain/room/service.go:141-223` → `CreateRoom` 83줄.
  - `apps/server/internal/domain/room/service.go:346-419` → `LeaveRoom` 74줄 (경계, P2 미달).
- Impact: 한도 80줄 초과. `PurchaseTheme` 는 특히 tx 안에서 여러 도메인 규칙 얽혀 있어 테스트 시 모킹 포인트 과다. coin 패키지 0% 커버리지 ([cross:04] baseline 기록) 와 맞물려 회귀 위험 ↑.
- Proposal:
  1. `coin.PurchaseTheme` → `purchaseThemePreCheck` (balance · ownership · price), `applyPurchaseLedger` (tx 안 CRUD), `emitPurchaseEvent` 세 helper 로 분리. tx는 상위에서 관리.
  2. `accusation.handleAccusationVote` → voteValidate / voteTally / voteFinalize 3 step.
  3. `editor/RequestUpload` · `ConfirmUpload` → mime/magic byte 검증 헬퍼(`validateAudioMagicBytes` 기존) 확장 + storage URL builder 분리.
  4. 위 리팩터는 F-go-3 의 파일 분할과 묶어서 진행.
- Cross-refs: [cross:04] 커버리지 0% coin 패키지.

### F-go-5: `httputil/json.go` `log.Printf` 잔재 — `zerolog` 전용 규칙 위반
- Severity: **P2**
- Evidence: `apps/server/internal/httputil/json.go:22` — `WriteJSON` 인코딩 실패 시 표준 `log.Printf("httputil.WriteJSON: encode error: %v", err)`. `zerolog` 미경유.
- Impact: 프로덕션 출력 포맷 불일치(JSON 구조화 로그 스트림에 평문 한 줄 섞임), log shipper 파싱 실패 가능. 영향 범위 작음 → P2.
- Proposal: 이 파일은 zerolog logger 미주입 상태이므로 선택지 두 가지.
  - (A) WriteJSON 시그니처 유지 + 전역 `log` package 의존 대신 `zerolog.Ctx(r.Context())` 를 쓰는 `WriteJSONCtx(r, w, status, v)` 변형 추가. 기존 WriteJSON 은 deprecated 표기 후 점진 치환.
  - (B) 단순히 `import stdlog "log"` + `zerolog.New(io.Discard)` 대체 no. 차선.
- Cross-refs: 없음.

### F-go-6: 모든 30+ 도메인 핸들러 DI 수동 생성자 + Service 인터페이스 패턴 준수 확인 (positive finding)
- Severity: **P2** (개선 제안만, 현재 위반 없음)
- Evidence: `rg 'queries\s*\*db\.Queries|pool\s*\*pgxpool\.Pool' --glob '**/handler*.go'` 결과 0건. `editor/handler.go`, `room/handler.go`, `social/handler.go`, `coin/handler.go` 등 모두 `svc Service` / `svc FriendService` 등 인터페이스만 주입. `http.Error` 경로(F-go-1) 제외하면 `apperror.WriteError(w, r, err)` 일관 사용.
- Impact: 계층 경계 양호. 감사 기준 "Handler가 Service/Repo 없이 DB 직접 호출하는 public 엔드포인트" P0 시드 **해당 없음**. 이는 긍정적 baseline 으로 기록.
- Proposal: `_ "github.com/...internal/module/..."` blank import 와 유사하게 handler 계층에도 compile-time boundary check(`staticcheck` custom rule 또는 `depguard`)를 CI 추가해 회귀 방지. Phase 18.7 linter 부채 ([cross:04]) 정리와 묶어서 처리.
- Cross-refs: [cross:04] golangci-lint↔Go1.25 부채.

### F-go-7: `context.Background()` 프로덕션 잔재 최소 — `session.go:106` 초기값 1건
- Severity: **P2**
- Evidence: `rg 'context\.Background\(\)' internal/ --type go | grep -v _test.go` 결과 실사용은 `apps/server/internal/session/session.go:106`(세션 actor context 초기값, 주석으로 명시) 단 1건. 나머지는 모두 `*_test.go` 또는 주석.
- Impact: 세션 actor의 `ctxBeforeRun` 반환값 역할로 의도된 디자인 (코드 L92-106 주석에 설명). 데이터 문제 아님.
- Proposal: 현 상태 유지. 단 주석에 "production에서는 Run 시작 후 per-session context 로 교체됨" 한 줄 보강해 향후 감사자가 혼동하지 않게.
- Cross-refs: 없음.

### F-go-8: WS hub 라이프사이클 listener 의 신규 goroutine — context 무주입 / hub.Stop 시 graceful cancel 없음
- Severity: **P1** (경계: 현재 listener는 in-memory지만 DB/WS 호출 listener 가 Phase 19 이후 추가될 가능성 ↑. hub.Stop 이 fire-and-forget goroutine 을 기다리지 않는 구조적 문제 → 예방적 P1)
- Evidence: `apps/server/internal/ws/hub.go:559,591` — `notifyPlayerLeft` / `notifyPlayerRejoined` 가 `go func()` 로 listener 들을 비동기 호출. 함수 내부에서 `ctx` 매개변수 없음. listener 인터페이스(`SessionLifecycleListener.OnPlayerLeft(sessionID, playerID, graceful)`) 가 ctx 를 받지 않는 구조.
- Impact: panic recovery는 있으나 (L-6 fix 주석), ctx cancellation 전파 불가. listener 안에서 DB 호출 시 hub Stop 시점에도 상한 없음. 현재 listener 구현은 in-memory presence 정도라 실측 누수 없음 → P2. [cross:06] goroutine leak 관점.
- Proposal: `SessionLifecycleListener` 에 `ctx context.Context` 인자 추가 + hub 종료 시 `ctx.Done()` 채널을 listener 로 전파. 시그니처 변경이라 Phase 19 PR 1 건 규모.
- Cross-refs: [cross:06] perf-observability (goroutine leak), [cross:03] listener 구현이 모듈·세션 매니저 양쪽에서 등록되므로 module-architect 와 조정.

## Metrics

| 지표 | 값 | 비고 |
|------|---|-----|
| 수동 작성 Go `.go` 500줄 초과 | **10** | baseline.md §1 기준. sqlc gen 5 개 제외 |
| 함수 80줄 초과 (표본 12 파일 스캔) | **6건** | PurchaseTheme 156 / RefundTheme 115 / handleAccusationVote 101 / RequestUpload 89 / ConfirmUpload 85 / CreateRoom 83 |
| `http.Error` 직접 호출 (`apperror.WriteError` 우회) | **12** 위치, 3 파일 | seo 3 + infra/storage/local 8 + ws/upgrade 1 |
| Handler 에 `*db.Queries`/`*pgxpool.Pool` 필드 | **0** | 계층 경계 양호 |
| `apperror.` 참조 파일 | 78 | `errors.New`/`fmt.Errorf` 470 건(대다수 service 내부), `apperror.` 972 건 — 비율 약 2:1 |
| 프로덕션 `context.Background()` | **1** | session.go 주석 설계, 데이터 문제 아님 |
| `log.Printf` / `log.Println` / `fmt.Println` 잔재 | **1** | httputil/json.go 단독 |
| 신규 goroutine (`go func(`) 프로덕션 | **4** 위치, 2 파일 | hub.go 2 (lifecycle) · server.go 1 (shutdown) · ws/hub.go 2 (위 finding 포함) |

## Advisor-Ask

- Q1: F-go-3 의 파일 분할 (editor/handler.go · ws/hub.go · social/service.go) 을 Phase 19 첫 PR 로 묶을지, 아니면 해당 도메인 기능 변경 PR 에 점진 적용할지 — 대량 import 경로 변경이라 Phase 19 cross-stream 충돌 우려.
- Q2: F-go-1 의 `apperror` 전환 중 `infra/storage/local.go` 8 곳은 dev-only 경로인데 Problem Details 응답이 프론트 에러 핸들링 계층에 영향을 줄 수 있음. 단일 PR 로 묶어도 되는지, 아니면 `05-security` 와 보안 리뷰 먼저 거쳐야 하는지.
- Q3: F-go-8 의 `SessionLifecycleListener` ctx 추가는 09 WS contract · 03 module-architect 양쪽 스킬과 접점이 있음. Phase 19 에서 단독 PR 로 처리할지, 또는 engine side effect 통일 PR (module-architect 주도) 에 흡수시킬지.
