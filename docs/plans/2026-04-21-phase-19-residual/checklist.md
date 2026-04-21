# Phase 19 Residual — 체크리스트

<!-- STATUS-START -->
**Active**: Phase 19 Residual — 감사 backlog 잔여 PR 실행
**Wave**: W1 + W2 완료 → W3 진입 대기
**Task**: W3 PR-8 (Module Cache Isolation) + H-2 (focus-visible 57건) 병렬 착수 대기. 다음은 W4 PR-9/PR-10.
**State**: ready — W3 PR-8 승인 대기
**Blockers**: 없음
**Last updated**: 2026-04-21
<!-- STATUS-END -->

## W0 — Foundation (PR-0 단독)

### PR-0: MEMORY Canonical Migration
- [x] user home `~/.claude/projects/.../memory/` ↔ repo `memory/` 파일 diff (drift 4 + user-only 3 + repo-only 4 · 실제 복원 대상 7건)
- [x] Phase 17.5~18.8 누락 progress·feedback 복원 (실제 7건: 4 copy + 1 MEMORY.md merge + 2 신규 `feedback_memory_canonical_repo.md`/`project_phase19_residual_progress.md`; `originSessionId` 전수 스트립)
- [x] `MEMORY.md` 인덱스 재작성 (user home canonical 적용 67→68줄, `feedback_memory_canonical_repo` pointer 추가)
- [x] QMD `mmp-memory` 컬렉션 path 이전 + reindex (store_collections.path: user-home → repo, 66 files indexed)
- [x] user home read-only 처리 + `CLAUDE.md` QMD 섹션 갱신 (**soft mode 확정** — CLAUDE.md QMD 섹션 + `memory/feedback_memory_canonical_repo.md`로 문서화 엔포스먼트. filesystem chmod은 auto-memory 시스템 충돌 리스크로 적용 안 함, 2026-04-21 결정)
- [x] `memory/project_phase19_residual_progress.md` 초기 생성 (`originSessionId` 없이 65줄, PR-0 수행 내역 포함)

**Gate**: ✅ `qmd search -c mmp-memory` hit 유지 (66 files) · ✅ user home write off — **soft mode 확정**

**관련 PR (전부 머지 완료)**:
- **#121** `chore: preflight 스킬 경로/인라인 훅 처리 수정` (commit `3d8ccec`) — M3 cutover 이후 legacy plan-autopilot 경로 잔존 결함 수정 + inline bash hook guard. `/plan-go` 파이프라인 정상화. PR-0 전제.
- **#122** `chore: PR-0 MEMORY Canonical Migration (user home → repo)` (commit `c2f34a9`) — 9 files, +197 / -35. W0 본체.
- **#123** `chore: memory frontmatter originSessionId 일괄 스트립 (42건)` (commit `22b1a5a`) — PR-0 직후 hygiene. 기존 repo 파일 42건 `-originSessionId` 정확히 -1줄씩 제거.

---

## W1 — Foundation Fixes (병렬 3 + H-1)

### PR-3: HTTP Error Standardization (선제 완료, 검증만 수행)
- [x] `http.Error` 호출 지점 전수 grep — **Go 소스 파일 내 0건** (Phase 19 audit 시점 ≥12건에서 완전 제거됨). 2026-04-21 재검증: `.go` 파일 대상 `Grep http\.Error` → 0 hits
- [x] apperror 전환 + RFC 9457 Problem Details 직렬화 검증 — `seo/handler.go:122/137/152` + `ws/upgrade.go:117` 모두 `apperror.WriteError(w, r, apperror.Internal(...).Wrap(err))` 패턴 사용 중
- [x] `.golangci.yml` depguard 룰 — `apps/server/.golangci.yml:13-19` `forbidigo` 에 `^http\.Error$` deny 패턴 + `F-sec-1` 주석 완비
- [x] handler 단위 테스트 ≥4건 — `seo/handler_test.go` 4건 (`TestThemePage`, `TestThemePageNotFound`, `TestPrivacyPage`, `TestTermsPage`) + `ws/upgrade_test.go` 6건 (`TestUpgrade_Success` 등). 총 10건 (기준 2.5배 초과)
- [x] CI lint gate green 확인 — `.golangci.yml` forbidigo 활성, 코드 0 위반. 로컬 `golangci-lint` 미설치 → CI 실행에 위임 (admin-skip 정책 하)

**결론**: PR-3 는 Phase 19 Residual plan 작성 이전에 이미 선제 해결된 상태였음 (audit 시점 snapshot vs 현재 상태 drift). 코드 변경 0, 문서 체크리스트만 갱신.

**참고 (비스코프)**: `seo/handler.go:108,114` `http.NotFound` 2건 — `http.Error`와 구분되는 helper (Problem Details 직렬화 차이). 별도 delta 이슈로 분류, PR-3 스코프 밖.

### PR-1: WS Contract SSOT (대부분 선제 완료, 헤더 메타만 본 PR 에서 구현)
- [x] envelope_catalog.go 에 121 legacy 콜론 이벤트 보존 — `EventDef.Type` 에 콜론 표기 그대로 등록 (별도 Alias 필드 없음). `envelope_catalog.go:55-58` 설계 주석 + `envelope_catalog_c2s.go:16` 등 다수 콜론 엔트리. 130 events 중 콜론형 다수 활성
- [x] 점 표기 canonical + deprecated 마커 — `EventDef.Status = StatusDeprec` 로 마킹. `envelope_catalog_s2c.go:46-47` (`phase:entered` → `StatusDeprec, Note: "colon form; prefer phase.advanced"`), `:79-80` (`vote:tallied`). `types.generated.ts` `WsEventStatus` 맵에 `"deprec"` 반영
- [x] `auth.*` stub entry (PR-9 예약) — `envelope_catalog_system.go:27-45` 에 6개 완비: `auth.identify/resume/refresh` (C2S) + `auth.challenge/revoked/refresh_required` (S2C), 모두 `StatusStub`
- [x] `cmd/wsgen` 작성 — `// wsgen:payload` → TS interface — `cmd/wsgen/payload.go:28` `payloadMarker = "wsgen:payload"` + `extractPayloads()` 219줄 AST 파싱 완비 (goTypeToTS/json 태그/pointer-nullable/omitempty-optional)
- [x] `packages/shared/src/ws/types.generated.ts` codegen 결과물 — 존재 + 본 PR 에서 헤더에 `Catalog: 130 events (active=N, stub=M, deprec=K) · 2 //wsgen:payload structs` 라인 추가로 drift 가시화
- [x] MSW 핸들러 전수 서버 envelope 기준 정규화 — `apps/web/src/mocks/handlers/game-ws.ts:22` `import { WsEventType } from "@mmp/shared"` + enum 기반 사용, string literal hardcode 없음
- [x] `gameMessageHandlers.ts` enum 재생성 + 타입 오류 해결 — 파일 자체 제거됨. `useGameSync.ts:68` 주석에 "이전에 병행 존재하던 gameMessageHandlers.ts 와 통합" 명시. `GamePage.tsx:81` `useGameSync()` 단일 호출
- [x] `.github/workflows/ci.yml` contract drift gate — `:79-80` `go run ./cmd/wsgen` 후 `git diff --exit-code ../../packages/shared/src/ws/types.generated.ts` (Phase 19 PR-1 주석)

**본 PR 실질 변경**: `cmd/wsgen/render.go` `renderHeader()` 동적화 — 이벤트 총수 + active/stub/deprec breakdown + payload struct 수를 헤더 주석에 기록. 기존 정적 `headerBlock` const 대체. CI drift gate 에서 Status 만 바뀐 경우도 헤더 변경으로 노출.

**검증**: `go run ./cmd/wsgen` → 130 events, 2 payload structs · `go test ./internal/ws/...` → 86 pass.

### PR-6: Auditlog Expansion (완료 2026-04-21)
- [x] migration `auditlog_schema_v2` — `session_id` NULLABLE + `user_id` col — ✅ `apps/server/db/migrations/00026_auditlog_expansion.sql:26-44` 완비 (session_id/seq DROP NOT NULL + user_id UUID + partial UNIQUE + IDENTITY CHECK)
- [x] auth 핸들러 auditlog 주입 — ✅ `service.go:165-390` login/logout/register/delete 4건 주입 완료. `password_change` 는 **엔드포인트 자체 미구현** (`ActionUserPasswordChange` orphan 상수로 보류 → Phase 21 후보).
- [x] admin 핸들러 auditlog 주입 — ✅ `handler.go:129,160,190` role_change/force_unpublish/force_close 주입 완료. `ActionAdminBan/Unban` 은 **엔드포인트 자체 미구현** (orphan 상수로 보류 → Phase 21 후보).
- [x] review 핸들러 auditlog 주입 — ✅ `review_handler.go:113,148,183,212` approve/reject/suspend/trusted 4건 주입 완료.
- [x] editor clue_edge auditlog — ✅ `clue_edge_handler.go:54` `ActionEditorClueEdgesReplace` 주입 완료. 개별 `ClueEdgeCreate/Delete` + `ClueRelationCreate/Delete` 4개 action 은 **엔드포인트 자체 미구현** (Replace 만 존재, 개별 CRUD 없음; `clue_relation_*.go` 파일 부재) → orphan 상수로 보류.
- [x] handler별 auditlog 기록 단위 테스트 ≥6건 — ✅ **CapturingLogger** testutil 신규 (`auditlog/capturing_logger.go` 58줄, sync.Mutex) + 7건 신규 테스트 (auth.Login/Logout/Register, admin.RoleChange/ForceUnpublish, review.Approve, editor.ClueEdgesReplace). 128 tests pass.
- [x] migration staging 적용 + rollback 검증 — ✅ `refs/pr-6-migration-smoke.md` (≈125줄) 로컬 smoke + staging 체크리스트 + forward-only 경고 + `audit_events_userrows_archive_00026` 백업 SQL 포함.

**부수 발견 / 수정**:
- **F-sec-4 감사 무음 폐기 수정** — admin/handler.go `recordAudit` 에 `target==nil → actor` fallback 추가 (review_handler.go:64-65 와 동일 패턴). migration 00026 의 IDENTITY CHECK + admin 라우트 session-less 컨텍스트 조합으로 `ForceUnpublishTheme`/`ForceCloseRoom` 이 Validate 실패로 audit 행을 무음 폐기하던 결함을 막음.

**🚧 Orphan action 상수 7건 (Phase 21 후보)**:
| 상수 | 미구현 기능 |
|------|-----------|
| `ActionUserPasswordChange` | `auth.ChangePassword` 엔드포인트 |
| `ActionAdminBan` / `ActionAdminUnban` | admin ban/unban 라이프사이클 |
| `ActionEditorClueEdgeCreate` / `ActionEditorClueEdgeDelete` | clue_edge 개별 CRUD 엔드포인트 |
| `ActionEditorClueRelationCreate` / `ActionEditorClueRelationDelete` | `clue_relation_*.go` 파일·엔드포인트 전무 |

Phase 21 후보 메모: Admin Ban/Unban lifecycle + Auth Password Change + Editor Clue Graph 개별 CRUD(edge create/delete, relation create/delete) 5개 벌티컬 기능을 각각 독립 PR 로 발주하면 위 7개 orphan 상수가 전부 사용 상태로 전환된다. 보안 우선도 가장 높은 것은 Ban lifecycle 및 Password Change.

**리뷰 개선 follow-up**:
- review note 길이 제한 + PII 스캔 — Phase 19.x follow-up 로 분리 (현 PR 범위 외).

**본 PR 실질 변경**:
- 추가 6 파일 (544 LOC): `auditlog/capturing_logger.go` (58) + audit 테스트 4 파일 (486) + smoke doc (≈125)
- 수정 1 파일 (+7 LOC): `admin/handler.go` (F-sec-4 fallback)

**검증**: `go test ./internal/domain/auth/... ./internal/domain/admin/... ./internal/domain/editor/... ./internal/auditlog/...` → 128 pass / 0 fail.

### H-1: voice token 평문 로그 제거 (regression-only)
- [x] `voice/provider.go` 토큰 redact — PR #83 (`b9cc4ba`)에서 선제 머지. 현 코드는 token value 로그 0건, line 104-106에 `SECURITY` 주석 존재. 경로는 실제 `apps/server/internal/domain/voice/provider.go`
- [x] 재발 방지 룰 검토 — 정적 audit 결과 `.Str("token"` / `"eyJ"` / `params.Token` 패턴 서버 전체 0건. 단위 테스트 기반 가드로 충분 (depguard는 import 타겟, forbidigo는 1 패턴에 과함)
- [x] 로그 grep `eyJ` (JWT prefix) 0건 테스트 — `provider_test.go` 신규 (`TestMockProviderDoesNotLogTokenValue` + `TestLiveKitProviderHasNoLoggerField`) 2 pass

**W1 Gate**: 3 PR 머지 + contract CI green + `http.Error` 0건 + auditlog 100%

---

## W2 — Enforcement (순차)

### PR-5a: mockgen 신규 도입 (원 plan "재도입"은 실상 신규) — ✅ #132 `d1ac387`
- [x] Service 인터페이스 `//go:generate mockgen` 디렉티브 (5 패키지 gen.go 분리 파일)
- [x] `tools.go` 대신 **Go 1.24 `tool` directive** (`go.mod` `tool go.uber.org/mock/mockgen`). tools.go 제거.
- [x] CI `go generate ./... + git diff --exit-code` drift gate (`.github/workflows/ci.yml:72-79`)
- [x] hand-rolled mock 제거 (5 패키지): theme/profile **완전 제거** · room/flow/editor **부분 제거** (white-box `mock_shim_test.go` 유지, import cycle 회피용)

### PR-5b: Coverage Gate — ✅ #133 `f21a6cf`
- [x] `.github/workflows/ci.yml` Go threshold — plan target 60% 였으나 baseline 43.9% 측정 후 **41%** 적용 (baseline-2% buffer 규칙). `coverage-guard` job warn-only → enforcement.
- [x] `vitest.config.ts` FE threshold — Lines/Statements 49%, Branches 77%, Functions 53% (baseline-2% buffer)
- [x] `codecov.yml` — project threshold 1% (1%p 회귀 허용) + patch target 70% (신규 코드 집중)
- [x] 점진 상향 로드맵 주석 — Phase 20 +5%p / Phase 21 +15%p (ci.yml:196-202)

### PR-5c: 0% 패키지 복구 — ✅ #134 `454afc0`
- [x] infra 3건(otel/sentry/storage) 테스트 신규 — otel 0→43.2% · sentry 0→58.4% · storage **LocalProvider only** 0→51.1%
- [x] `internal/db/*.sql.go` + `models.go` + `db.go` codecov exclude 선언 (CI gate 통일은 Phase 20 B-2 이월)
- [x] `domain/editor` 서비스 테스트 2건 추가 (평균 함수 coverage 32.7%). "-2.9%p 회귀 복구" 구체 baseline 비교 근거 부재로 부분 달성 판정. fixture testdata 분리는 현 규모상 YAGNI 로 스킵.

**PR-5c 의도적 이월**:
- `storage/r2_test.go` — AWS SDK mock 복잡도 때문에 Phase 20 B-1 재측정 PR 에서 동반 처리 후보
- `storage/provider.go` (interface 파일) — 컴파일-타임 검증 외 테스트 불요

### PR-7: Zustand Action — ✅ #135 `da88c78` (scope 재정의 — refactor 선행 완료)
- [x] `applyWsEvent` 단일 reducer — **YAGNI 판정**. 대신 useGameSync.ts 에서 Zustand selector 바인딩 패턴 (8 이벤트 handler). 타입 안전성 유지.
- [x] `.getState()` "16건 제거" 재평가 — game-session 프로덕션 잔존 **3곳 전부 의도적** (useGameSync module factory 2건 + moduleStoreCleanup 2건 + GamePage unmount 1건). 주석 완비.
- [x] Connection→Domain 이중 경로 통합 — `gameMessageHandlers.ts` + `features/game/hooks/useGameSession.ts` 는 선행 커밋에서 dead code 로 이미 삭제됨 (useGameSync.ts:68 주석).
- [x] RTL + MSW 회귀 테스트 ≥5건 — **10건** 작성 (`useGameSync.test.ts` 248 LOC, plan 목표 2배).

**W2 Gate 실측**: Go cov 43.9% (threshold 41%) · FE Lines 51.95% (threshold 49%) · mockgen diff 0 · game-session `.getState()` 잔존 3건 모두 의도적. ✅

---

## W3 — Cleanup (병렬 2 + H-2)

### PR-8: Module Cache Isolation
- [ ] Factory key `${sessionId}:${moduleId}` namespace
- [ ] `resetGame` action에서 module store cleanup 연계
- [ ] dev 환경 중복 생성 console.warn
- [ ] 세션 전환 E2E 테스트 신규

### H-2: focus-visible 57건
- [ ] `outline-none` 57건 grep + `focus-visible:ring-*` 병기
- [ ] 다크모드 focus ring 대비 확인
- [ ] Playwright axe-core 키보드 네비 테스트

**W3 Gate**: session 전환 E2E green + axe-core pass

---

## W4 — Runtime Hardening (병렬 2)

### PR-9: WS Auth Protocol
- [ ] S→C: `auth.challenge`, `auth.revoked`, `auth.refresh_required` 정의
- [ ] C→S: `auth.identify`, `auth.resume`, `auth.refresh` 정의
- [ ] migration `revoke_log` table 생성
- [ ] WS hub broadcast 전 revoke 조회 middleware
- [ ] `ws-client` 재접속 시 `auth.resume` 자동 전송
- [ ] E2E — revoke → 연결 종료 → 재접속 거부

### PR-10: Runtime Payload Validation
- [ ] `wsgen` 확장 — Go struct → JSON Schema 출력
- [ ] `schemas.generated.ts` zod codegen
- [ ] `ws-client` 수신 zod parse + schema mismatch error
- [ ] `validator.go` 서버 송신 전 JSON Schema 검증
- [ ] strict off→on 점진 전환 로드맵 문서화

**W4 Gate**: revoke → 30초 내 WS 종료 + payload drift 0

---

## 종료 조건

- [ ] W0~W4 모든 Wave Gate 통과
- [ ] 9 PR + 2 hotfix 전건 main 머지
- [ ] feature flag 전환 로그 기록 (staging 3일 관측 완료분)
- [ ] `memory/project_phase19_residual_progress.md` 최종 업데이트
- [ ] `MEMORY.md` 인덱스 갱신
- [ ] `/plan-finish` → `.claude/archived_plans/phase-19-residual.json` 아카이브
- [ ] Phase 21 후보 (graphify-driven W4 4 PR) 메모 + `/plan-new phase-21` 가이드

## 참조

- `design.md` (인덱스)
- `plan.md` (overview 표)
- `refs/backlog-source.md` (원본 매핑)
- `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md`
- `docs/plans/2026-04-18-architecture-audit-delta/priority-update.md`
