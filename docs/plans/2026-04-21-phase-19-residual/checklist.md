# Phase 19 Residual — 체크리스트

<!-- STATUS-START -->
**Active**: Phase 19 Residual — 감사 backlog 잔여 PR 실행
**Wave**: W0 (착수 대기)
**Task**: PR-0 착수 전 — `.claude/active-plan.json` 활성화 + 본 plan PR 머지
**State**: in_progress
**Blockers**: 없음 (plan init PR 머지 대기)
**Last updated**: 2026-04-21
<!-- STATUS-END -->

## W0 — Foundation (PR-0 단독)

### PR-0: MEMORY Canonical Migration
- [ ] user home `~/.claude/projects/.../memory/` ↔ repo `memory/` 파일 diff
- [ ] Phase 17.5~18.8 누락 progress·feedback 최소 9건 repo 복원
- [ ] `MEMORY.md` 인덱스 재작성 (현행 반영)
- [ ] QMD `mmp-memory` 컬렉션 path 이전 + reindex
- [ ] user home read-only 처리 + `CLAUDE.md` QMD 섹션 갱신
- [ ] `memory/project_phase19_residual_progress.md` 초기 생성

**Gate**: `qmd search -c mmp-memory` hit 유지 + user home write off

---

## W1 — Foundation Fixes (병렬 3 + H-1)

### PR-3: HTTP Error Standardization
- [ ] `http.Error` 호출 지점 전수 grep (≥12건 대상)
- [ ] apperror 전환 + RFC 9457 Problem Details 직렬화 검증
- [ ] `.golangci.yml` depguard 룰 (`net/http.Error` deny)
- [ ] handler 단위 테스트 ≥4건 추가
- [ ] CI lint gate green 확인

### PR-1: WS Contract SSOT
- [ ] envelope_catalog.go에 121 legacy 콜론 이벤트 `Alias` 보존
- [ ] 점 표기(`<category>.<action>`) canonical + deprecated 마커
- [ ] `auth.*` stub entry 추가 (PR-9 예약)
- [ ] `cmd/wsgen` 작성 — `// wsgen:payload` → TS interface
- [ ] `packages/shared/src/ws/types.generated.ts` codegen 결과물
- [ ] MSW 핸들러 전수 서버 envelope 기준 정규화
- [ ] `gameMessageHandlers.ts` enum 재생성 + 타입 오류 해결
- [ ] `.github/workflows/ci.yml` contract drift gate

### PR-6: Auditlog Expansion
- [ ] migration `auditlog_schema_v2` — `session_id` NULLABLE + `user_id` col
- [ ] auth 핸들러 auditlog 주입 (login/logout/password_change)
- [ ] admin 핸들러 auditlog 주입 (approve/reject/ban)
- [ ] review 핸들러 auditlog 주입 (publish/unpublish)
- [ ] editor clue_edge + clue_relation auditlog (delta D-SEC-1)
- [ ] handler별 auditlog 기록 단위 테스트 ≥6건
- [ ] migration staging 적용 + rollback 검증

### H-1: voice token 평문 로그 제거
- [ ] `voice/provider.go:108` 토큰 redact (`token[:8]+"..."`)
- [ ] 재발 방지 룰 (zerolog field `token` deny 검토)
- [ ] 로그 grep `eyJ` (JWT prefix) 0건 테스트

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
