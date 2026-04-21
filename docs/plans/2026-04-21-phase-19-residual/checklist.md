# Phase 19 Residual — 체크리스트

<!-- STATUS-START -->
**Active**: Phase 19 Residual — 감사 backlog 잔여 PR 실행
**Wave**: W1 (PR-0/3/1/H-1 완료 · PR-6 현황 스캔 완료 → 다음 세션 착수)
**Task**: PR-6 잔여 3건 — (A) recordAudit 호출 5건 추가 (auth.password_change + admin.ban/unban + editor clue_edge/relation create/delete) / (B) handler 단위 테스트 ≥6건 (CapturingLogger 주입) / (C) migration 00026 staging 적용 + rollback 검증
**State**: paused — 세션 종료, 다음 세션 `/plan-resume` 경유 재개
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

### PR-6: Auditlog Expansion (현황 스캔 완료 2026-04-21, 다음 세션 착수)
- [x] migration `auditlog_schema_v2` — `session_id` NULLABLE + `user_id` col — ✅ `apps/server/db/migrations/00026_auditlog_expansion.sql:26-44` 완비 (session_id/seq DROP NOT NULL + user_id UUID + partial UNIQUE + IDENTITY CHECK)
- [ ] auth 핸들러 auditlog 주입 (login/logout/password_change) — ⚠️ 부분. `service.go:165-390` login/logout/register/delete ✅. **password_change 엔드포인트 자체 미구현** (ActionUserPasswordChange 상수만 `event.go:34`). 결정 필요: PR-6 스코프로 `ChangePassword` 메서드 신규 구현 vs 별도 PR 분리
- [ ] admin 핸들러 auditlog 주입 (approve/reject/ban) — ⚠️ 부분. `handler.go:129,160,190` role_change/force_unpublish/force_close ✅. **ActionAdminBan/Unban 호출 0건** — ban 엔드포인트 존재 여부 먼저 확인 필요 (감사 공백 F-sec-4 리스크)
- [x] review 핸들러 auditlog 주입 (publish/unpublish) — ✅ `review_handler.go:113,148,183,212` approve/reject/suspend/trusted 4건 주입
- [ ] editor clue_edge + clue_relation auditlog (delta D-SEC-1) — ⚠️ 부분. `clue_edge_handler.go:54` ActionEditorClueEdgesReplace ✅. **Create/Delete + Relation_Create/Relation_Delete 4개 action 호출 0건** (상수는 `event.go:53-57`). 잔여: 개별 CRUD 경로에 4개 호출 추가
- [ ] handler별 auditlog 기록 단위 테스트 ≥6건 — ❌ 미착수. admin/handler_test.go 9건 + auth/handler_test.go 7건 모두 NoOpLogger 통과, auditlog 검증 0건. **CapturingLogger 주입 + ≥6건 신규 작성 필요**
- [ ] migration staging 적용 + rollback 검증 — ❌ 미착수. 00026 Down 절 완비지만 실제 goose up/down 미수행. **리스크**: Down 이 `DELETE WHERE session_id IS NULL` 이므로 staging user-only 행 rollback 시 데이터 소실

**다음 세션 재개 가이드**:
1. `/plan-resume` 실행 → active-plan.json 의 `current_pr=PR-6` 자동 복원
2. `git checkout -b feat/phase-19-residual/pr-6-auditlog-expansion`
3. 착수 순서 권장: (i) editor clue_edge/relation 4건 recordAudit (가장 격리됨) → (ii) admin ban/unban 결정 (엔드포인트 유무 먼저) → (iii) auth password_change 결정 → (iv) T6 handler 테스트 → (v) T7 staging
4. scan_summary 상세는 `.claude/active-plan.json` `prs.PR-6` 참조

### H-1: voice token 평문 로그 제거 (regression-only)
- [x] `voice/provider.go` 토큰 redact — PR #83 (`b9cc4ba`)에서 선제 머지. 현 코드는 token value 로그 0건, line 104-106에 `SECURITY` 주석 존재. 경로는 실제 `apps/server/internal/domain/voice/provider.go`
- [x] 재발 방지 룰 검토 — 정적 audit 결과 `.Str("token"` / `"eyJ"` / `params.Token` 패턴 서버 전체 0건. 단위 테스트 기반 가드로 충분 (depguard는 import 타겟, forbidigo는 1 패턴에 과함)
- [x] 로그 grep `eyJ` (JWT prefix) 0건 테스트 — `provider_test.go` 신규 (`TestMockProviderDoesNotLogTokenValue` + `TestLiveKitProviderHasNoLoggerField`) 2 pass

**W1 Gate**: 3 PR 머지 + contract CI green + `http.Error` 0건 + auditlog 100%

---

## W2 — Enforcement (순차)

### PR-5a: mockgen 재도입
- [ ] Service 인터페이스에 `//go:generate mockgen` 디렉티브
- [ ] `tools.go`로 mockgen 의존성 확정
- [ ] CI `go generate ./...` diff 0 gate
- [ ] hand-rolled mock 제거 (≥5 패키지)

### PR-5b: Coverage Gate
- [ ] `.github/workflows/ci.yml` Go threshold 60% hard fail
- [ ] `vitest.config.ts` frontend threshold 50%
- [ ] `codecov.yml` patch threshold +0 (회귀 차단)
- [ ] 점진 상향 로드맵 주석 (70%→75% 단계)

### PR-5c: 0% 패키지 복구
- [ ] infra 3건(otel/sentry/storage) 테스트 신규 작성
- [ ] `cmd/internal/db` "intentionally excluded" 선언
- [ ] `domain/editor` -2.9%p 회귀 복구 + fixture 분리 (GI-4)

### PR-7: Zustand Action Unification
- [ ] `applyWsEvent` 단일 reducer action 정의
- [ ] `.getState()` 호출 16건 제거
- [ ] Connection→Domain 이중 경로 통합
- [ ] RTL + MSW 회귀 테스트 ≥5건

**W2 Gate**: Go cov ≥60% + FE ≥50% + mockgen diff 0 + `.getState()` 0

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
