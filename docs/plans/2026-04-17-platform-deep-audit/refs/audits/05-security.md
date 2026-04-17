# 05 Security — Phase 19 W2 Audit Draft

> Primary: OWASP Top 10, AppError+RFC 9457, WS 토큰 노출, auditlog, snapshot redaction, 의존성 CVE.
> 기준 시점: main @ 858a1fa (Phase 18.8 hotfix #4 직후, 2026-04-17).

## Scope

- `apps/server/internal/{apperror,middleware,auditlog}/**`
- `apps/server/internal/ws/upgrade.go`, `session/snapshot*.go`, `engine/phase_engine.go` (BuildStateFor 경계)
- `apps/server/internal/domain/auth/**`, `voice/**`, `admin/**`, `editor/**`, `seo/**`, `infra/storage/**`
- `apps/server/cmd/server/routes_*.go` (권한 middleware wiring)
- `apps/server/go.mod` (의존성), `.github/workflows/security-*.yml` (CI 스캐너 존재 확인)
- 금지: zerolog 효율(06), WCAG(07), 계층 경계(01), 모듈 내부(03).

## Method

1. `grep http.Error\(` + `grep token` + `grep Str("token"|"password"|"secret"` 로 직접 쓰기·로그 누출 검색.
2. `PlayerAwareModule` 구현 카운트: 전체 모듈 33 파일 vs BuildStateFor 구현 8 파일.
3. `RequireRole`·`auditlog.Log`·`WithInstance` grep으로 권한 middleware·감사 로그·Problem Details 완성도 확인.
4. `http.MaxBytesReader`·`json.NewDecoder` 사용으로 입력 제한 패턴 스캔.
5. `go.mod` 핵심 의존성 + `security-{fast,deep}.yml` 워크플로우로 CI CVE 게이트 확인.
6. W1 시드 (PlayerAware 0/33, auth 커버리지 11.6%, 18.1 B-2) 교차 검증.

## Findings

### F-sec-1 — RFC 9457 우회: `http.Error` 직접 호출 11회 [area:security] [cross:go-backend]
**Severity: P0**
- 증거:
  - `apps/server/internal/infra/storage/local.go:118,133,143,149,156,164,184,194` (8회, upload/serve 핸들러)
  - `apps/server/internal/seo/handler.go:121,136,151` (3회, theme/privacy/terms 렌더 실패)
  - `apps/server/internal/ws/upgrade.go:116` (1회, WebSocket upgrade 인증 실패)
- 문제: AppError+Problem Details 파이프라인(Sentry, trace_id, error code registry, zerolog 구조화 로그, dev/prod 메시지 마스킹)을 전부 우회. 프로덕션에서 `"internal error"`·`"unauthorized"`·`"Internal Server Error"` 평문 반환 → 클라이언트 코드 분기 불가·i18n 불가·trace_id 누락으로 incident 추적 불가.
- 참조: Phase 18.4 M-2 `TemplateHandler` 사건 패턴 재발. severity-rubric.md §P0 "RFC 9457 우회 `http.Error`" 정의에 직접 해당.
- 권장: `apperror.WriteError(w, r, apperror.Internal(...))`로 치환. `storage/local.go`는 업로드 전용 코드(`ErrImageInvalidType`·`ErrMediaTooLarge`) 재사용. 공용 helper(`apperror.WriteFromHTTPStatus`) 도입 고려.

### F-sec-2 — PlayerAware redaction boundary 구멍 25/33 [area:security] [cross:module-architect]
**Severity: P0**
- 증거: `PlayerAwareModule.BuildStateFor` 구현 8개 (whisper·hidden_mission·voting·starting_clue·timed_clue·conditional_clue·round_clue·trade_clue). `module-inventory`상 카테고리 합계 33 파일 중 25 파일이 미구현 → `engine.BuildStateFor`가 기본 `Module.BuildState()` fallback(`engine/types.go:100-105`).
- 검증: `engine/types.go:103-105` — `if pam, ok := m.(PlayerAwareModule); ok { return pam.BuildStateFor(...) } return m.BuildState()`. PlayerAware 미구현 모듈은 전체 상태가 모든 플레이어에게 동일하게 push됨.
- 영향: `persistSnapshot`(snapshot.go:73)과 `sendSnapshotForActor`(snapshot_send.go:91)가 모든 모듈에 대해 BuildStateFor를 호출. 25개 모듈 중 일부(예: `crime_scene/evidence.go`, `decision/accusation.go`, `communication/group_chat.go`)는 GM 단서·투표 집계·역할 메타 등 민감 필드를 **모든 플레이어에게 동일 스냅샷으로 전송** 가능. Phase 18.1 B-2 부분 수정의 나머지 — **redaction coverage 24%**.
- 참조: severity-rubric.md §P0 "PII/권한 스냅샷 누설". module-architect 03 draft primary.
- 권장:
  1. 각 모듈 `State` 구조체 공개 필드 감사 → 비공개 필드 있으면 PlayerAware 구현 필수로 지정.
  2. `engine.Module` 인터페이스에 `RequiresPlayerAware() bool` 명시 메서드 추가하고 registry가 감사(누락 시 boot fail).
  3. `BuildStateFor` 미구현 모듈의 `State` 필드에 `// visible_to:all` 주석 규약 도입, CI lint.
- [cross:module-architect]: 모듈 카탈로그에서 민감 필드 보유 여부 판정 + PlayerAware 리팩터링 계획.

### F-sec-3 — voice mock provider가 JWT token을 zerolog에 평문 출력 [area:security]
**Severity: P0 (개발 기본값이지만 프로덕션 설정 실수 시 즉시 유출)**
- 증거: `apps/server/internal/domain/voice/provider.go:103-110`
  ```go
  func (m *mockProvider) GenerateToken(_ context.Context, params TokenParams) (string, error) {
      token := fmt.Sprintf("mock-token-%s", params.PlayerID.String())
      m.logger.Debug().
          Str("room", params.RoomName).
          Str("player_id", params.PlayerID.String()).
          Str("token", token).          // 평문 로그
          Msg("mock: generated token")
  ```
- 문제: `feedback_ws_token_query.md` 규칙 "WS 토큰은 로그에 절대 출력 금지" 위반. mock은 deterministic token이지만 **진짜 LiveKit provider가 동일 패턴을 복제**할 위험 + mock이 prod에 실수 배포되면 로그 SIEM·Sentry breadcrumb에 세션 token 누적. 동일 파일 `livekitProvider.GenerateToken` (line 52)도 향후 동일 실수 유입 가능.
- 권장: `token` 필드 완전 제거 또는 `Str("token_fingerprint", sha256prefix(token, 8))`. zerolog 필드 redactor 미들웨어(`logger.Ctx.With().RedactKey("token")`) 도입 + handler에서 query에 `token=` 있으면 request log 필드 마스킹.

### F-sec-4 — 관리자/인증 변경 경로 0건 auditlog [area:security] [cross:go-backend]
**Severity: P0**
- 증거: `auditlog` 패키지는 존재(`internal/auditlog/{event,logger,store}.go`)하고 `engine.PhaseEngine`이 phase 전환을 기록하지만, `domain/` 전체에서 `auditlog.Log(...)`·`logger.Log(...)` 호출 **0건** (grep `auditlog\.(Log|LogAsync|Event)` → no matches).
- 영향 경로 (모두 admin role gated but NO audit):
  - `admin/handler.go` UpdateUserRole, ForceUnpublishTheme, ForceCloseRoom
  - `admin/review_handler.go` ApproveTheme, RejectTheme, SuspendTheme, SetTrustedCreator
  - `auth/service.go` Register(l.298 `logger.Info`), Login, Logout(l.201), DeleteAccount(l.353)
  - `auth/service.go:172` "refresh token reuse detected" — 보안 경보인데 zerolog warn만, audit table 없음.
- 문제: 권한 상승·테마 검열·계정 삭제·refresh token 재사용이 **비가역적·법적 증거** 필요 사건인데 zerolog만 남음(로그 로테이션 후 소실). GDPR/K-ISMS 감사 대응 불가, 내부자 위협 포렌식 불가.
- 참조: CLAUDE.md security-reviewer 작업 원칙 6 "감사 로그(auditlog): 인증 변경, 권한 변경, 관리자 액션은 반드시 기록". severity-rubric.md §A08 데이터 무결성.
- 권장:
  - `auth.service.Login`·`Register`·`DeleteAccount`·`Logout`(refresh 회수)에 `auditlog.Log(ctx, sessionID, "auth."+action, payload)` 호출 추가. session_id 대신 user_id 기반 audit store 확장 필요.
  - `admin.UpdateUserRole`·`Force*`·review `Approve/Reject/Suspend`에 actor(UserIDFrom)+subject+before/after 저장.
  - DB 스키마: `auditlog` 테이블이 session_id 전용이면(`store.go:178` "no events for session") 전용 `admin_audit` 테이블 또는 `session_id nullable` 마이그레이션 필요.

### F-sec-5 — 패스워드 최소 길이 4자 (OWASP A07) [area:security]
**Severity: P1**
- 증거: `apps/server/internal/domain/auth/handler.go:31` `Password string validate:"required,min=4"`
- 문제: OWASP ASVS 2.1.1 / NIST SP 800-63B §5.1.1.2 "minimum 8 characters" 미준수. 4자 조합 공간 ≈ 78^4 = 37M → 오프라인 bcrypt(cost 10)로 GPU 하루면 breach. `auth/service.go:282` bcrypt.DefaultCost(10)는 적정이나 입력 공간이 결정적 약점.
- 권장: `validate:"required,min=12"` + 공통 약한 비밀번호 차단(zxcvbn 또는 HIBP k-anonymity API). `service.go` 서버측 검증도 강화(핸들러 우회 방지).

### F-sec-6 — AppError `Instance` 필드 전 domain 미사용 [area:security]
**Severity: P1**
- 증거: `apperror/apperror.go:52` `WithInstance` 메서드 존재. `internal/domain/**`에서 `WithInstance` 호출 **0건** (grep → no matches). `handler.go:82-84` Problem Details 응답은 빈 `instance` 필드.
- 문제: RFC 9457 §3.1 "instance" — "A URI reference that identifies the specific occurrence of the problem". 미사용 시 incident 조사에서 "어떤 요청의 409였는가?" 특정 불가(trace_id는 있으나 trace가 saturate 시 유실).
- 권장: `apperror.WriteError` 내부에서 자동으로 `r.URL.Path`를 `Instance`로 기본 채움. 도메인 세부 리소스(`/admin/users/{id}`) 포함하면 tenant-aware debugging 가능.

### F-sec-7 — `go-chi/v5 v5.2.1` 포함 미패치 CVE 스택 [area:security]
**Severity: P1**
- 증거: `apps/server/go.mod:11` `go-chi/chi/v5 v5.2.1`. baseline.md §7 "go-chi/v5 v5.2.1 11 vulns / osv 29 vulns / trivy 3 HIGH — Phase 18.7 최초 식별, 현재 patch 미적용(warn-only)".
- 문제: Phase 18.7에서 `.github/workflows/security-{fast,deep}.yml` 스캐너는 도입됐지만 **gate가 warn-only** — main 머지 차단하지 않음. main HEAD에서 여전히 취약 버전 사용 중.
- 권장:
  - `chi/v5` → `v5.2.3`+ (CVE-2025-XXXX 패치 라인) 업그레이드 후 E2E 회귀.
  - `security-fast.yml` govulncheck step `continue-on-error: false` + severity HIGH 이상 fail.
  - Renovate(PR #62)가 이미 PR 생성했는지 확인 → merge.

### F-sec-8 — WS DevMode 쿼리 인증이 프로덕션으로 흘러들 위험 [area:security]
**Severity: P1**
- 증거: `apps/server/internal/ws/upgrade.go:18-20,29-31`
  ```go
  // DevMode enables insecure defaults (query-param auth).
  DevMode bool
  ...
  if cfg.DevMode && (len(origins) == 0 || origins["*"]) { return true }
  ```
  그리고 `upgrade.go:56-63`에 `DefaultPlayerIDExtractor` (`player_id` query param, dev only) 존재. `UpgradeHandler` 101-109에서 `!DevMode`면 `player_id` query 거부하지만, `DevMode=true`면 모든 origin 허용 + 서명 없는 player_id 수락.
- 문제: `DevMode`는 env 기반 boolean 단일 토글 — staging·prod 환경변수 설정 실수 1건으로 **무인증 WS 접속** 허용. Phase 18.3 hardening으로 query auth 일부 차단은 들어갔지만 `DevMode=true` + wildcard origin이면 완전 무방비.
- 권장:
  - `DevMode` flag를 build tag(`//go:build dev`)로 분리, production binary에 컴파일되지 않도록.
  - `DevMode=true`이면 bootstrap 로그에 `logger.Warn().Msg("WS DEV MODE ENABLED — DO NOT USE IN PROD")` 부팅 경고.
  - `CheckOrigin`이 env 하나가 아니라 `ENV=dev` + `ALLOWED_ORIGINS`·`EXPLICIT_DEV_AUTH=1` 이중 게이트 요구.

### F-sec-9 — Snapshot cache fallback의 legacy session-level key [area:security]
**Severity: P1**
- 증거: `apps/server/internal/session/snapshot_send.go:59-66`
  ```go
  // Fall back to legacy session-level key.
  data, err = s.cache.Get(ctx, snapshotKey(s.ID))
  ```
- 문제: M-7 이전(`persistSnapshot` player-specific 변경 이전)에 Redis에 기록된 `snapshot:{sessionID}` 키는 **세션 전체 상태**(모든 플레이어 역할·미션)를 담음. 현재는 `persistSnapshot`이 player 별 키만 쓰지만 TTL 만료 전까지 legacy 키 잔존 가능. reconnect 시 player-specific miss → legacy key hit → 타 플레이어 hidden_mission/whisper 누설.
- 완화 (부분): `deleteSnapshot`이 게임 종료 시 legacy 키도 삭제(snapshot.go:122). 하지만 **진행 중 세션에서 reconnect**가 legacy key TTL 안에 떨어지면 여전히 위험.
- 권장: legacy fallback 제거. 없으면 "스냅샷 복구 실패 → 플레이어에게 재요청 유도"가 redaction bypass보다 안전. 또는 legacy key도 per-player redaction 후 재-persist한 흔적이 없다는 불변식을 CI test로 고정.

### F-sec-10 — `Str("token", ...)` 직접 출력 차단 lint 부재 [area:security]
**Severity: P2**
- 증거: `feedback_ws_token_query.md` 규칙 존재하지만 grep 수동 발견(F-sec-3) — CI linter 없음. 현재는 voice/provider.go 1건이지만 future regression 방지 필요.
- 권장: `scripts/check-secret-logs.sh` 추가 — `Str\("(token|password|secret|api_key)"` 패턴 grep → CI pre-commit + PR workflow fail. `golangci-lint`의 `forbidigo` rule 활용.

### F-sec-11 — `auth/middleware` 커버리지 부족으로 보안 regression gate 없음 [area:security] [cross:test-engineer]
**Severity: P1**
- 증거: W1 seed — `domain/auth 11.6% / middleware 35.3%`. 핵심 경로인 `Auth()`·`RequireRole()`·`JWTPlayerIDExtractor`는 일부 테스트(`middleware/auth_test.go`)가 있으나 `Login/Register/DeleteAccount/RefreshToken` 회전 흐름 · `refresh token reuse detected` 경로는 미커버.
- 문제: F-sec-1 치환·F-sec-4 audit 추가·F-sec-8 dev mode hardening을 진행할 때 **회귀 보장 부재** → 수정 자체가 위험.
- 권장:
  - `auth/service_login_test.go` (mock queries + mock redis) — 성공/실패/refresh reuse/계정 삭제 시나리오 4건 추가.
  - `ws/upgrade_test.go`에 `DevMode=false`에서 token query 없을 때 401 + token 유효성 실패 경로 + origin mismatch 추가.
  - `apperror/handler_test.go`에 5xx dev/prod 메시지 마스킹 회귀 test 추가(이미 있는지 확인 후 보강).
- [cross:test-engineer]: 04 draft에서 auth·middleware·ws.upgrade 우선순위 보강 제안.

### F-sec-12 — `DeleteAccount`는 password 확인 있으나 bcrypt timing leak 가능성 [area:security]
**Severity: P2**
- 증거: `auth/service.go:330-345` — user_not_found 시 즉시 return, password 존재 시에만 bcrypt compare → 타이밍 분기.
- 문제: DeleteAccount는 인증된 사용자만 호출하므로 attacker가 자기 계정에 대해서만 실행 가능 → 이론적 위협 낮음. 다만 Login 경로 동일 패턴(line 304-322)은 **공개 엔드포인트**이며 user_not_found vs wrong_password 응답 시점이 다르면 email enumeration 가능.
- 권장: Login 실패 시 항상 더미 bcrypt compare 수행(`bcrypt.CompareHashAndPassword` to pre-computed hash)으로 timing 등가화. 향후 rate limit (F-sec 없음 — rate limit middleware 자체 부재) 도입 시 해결되는 side channel이지만 즉시 fix 가능.

## Metrics

| 지표 | 값 | 비고 |
|------|-----|------|
| `http.Error` 직접 호출 | 12회 / 3 파일 | Problem Details 우회 |
| `PlayerAware` coverage | 8/33 모듈 (24%) | 25 모듈 fallback 위험 |
| `auditlog.Log` 호출 — domain/ | 0건 | admin·auth 완전 미기록 |
| `http.MaxBytesReader` 사용 | 3곳 (editor×2, room×1) | 나머지 handler 무제한 |
| `WithInstance` 사용 | 0건 | Problem Details instance 빈 필드 |
| `go-chi/v5` 버전 | v5.2.1 | Phase 18.7 식별 CVE warn-only |
| WS token log | 1건 (voice mock) | deterministic mock이나 패턴 유입 위험 |
| Password min length | 4 | NIST 권장 8+ 미달 |

## Advisor-Ask (≤3)

1. **F-sec-2 (PlayerAware 25 구멍) vs 03 module-architect**: 민감 필드 보유 모듈을 24%만 보호하는 상태에서 `PlayerAwareModule` 의무화를 engine 레벨에서 강제(boot fail)할지, 모듈별 점진 마이그레이션(Phase 19.x)으로 둘지 — W3 advisor 판단 요망. **P0 해소의 crittical path**.
2. **F-sec-4 (auditlog 0건) 스키마 변경 범위**: 기존 `auditlog` 테이블이 `session_id NOT NULL` 전제라면 admin/auth 이벤트 기록 위해 별도 `admin_audit` 테이블 vs `session_id NULLABLE` 마이그레이션 중 어느 방향인지 결정 필요. sqlc query 재생성 + downtime 영향.
3. **F-sec-7 (chi CVE warn-only) gate 강화 타이밍**: Phase 18.7에서 의도적으로 warn-only 유지 — 지금 HIGH fail로 승격하면 Renovate가 아직 PR을 올리지 않은 미패치 dep로 **main 빌드 전체 정지** 가능. 감사 종료 시점(W4) 이후 전환이 안전한지, 아니면 W3에서 cross-cutting fix로 포함할지.

## Cross-refs

- [cross:go-backend] F-sec-1(`http.Error` 전환), F-sec-4(auditlog 호출 추가 wiring)
- [cross:module-architect] F-sec-2(PlayerAware 25 구멍 — 모듈 카탈로그 민감 필드 판정)
- [cross:test-engineer] F-sec-11(auth/middleware 커버리지 보강), F-sec-2(redaction 회귀 테스트)
- [cross:perf-observability] F-sec-3(zerolog redactor 미들웨어 — 필드 마스킹 패턴)
- [cross:docs-navigator] `feedback_ws_token_query.md`·`security-reviewer` 작업 원칙을 `project_coding_rules.md`의 "auditlog 필수 이벤트 목록"·"http.Error 금지"로 승격 필요
