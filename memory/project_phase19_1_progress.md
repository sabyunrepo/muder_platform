---
name: Phase 19.1 Audit Review Follow-ups 완료
description: PR-2c 사후 4-agent 리뷰 review-driven 잔여 3 PR(A/B/C) 2026-04-18 머지 완료. MEDIUM 2 + LOW 1 해소
type: project
---

# Phase 19.1 — 진행 로그 (완료)

> **시작:** 2026-04-18 (Phase 19 `/plan-finish` 후 승격)
> **완료:** 2026-04-18 (W1 단일 wave, 동일 세션)
> **기반:** PR-2c(#107) + hotfix(#108) 4-agent 사후 리뷰 — HIGH 1건(#108 해소) + MEDIUM 4건 + LOW 5+건
> **정책:** CI admin-skip (2026-05-01까지) · graphify refresh D 정책 · `/plan-go` 통합 진입점

## 완료 PR (W1 병렬 3, 순차 admin squash-merge)

### PR-A #111 (6e97ffb) — `MMP_PLAYERAWARE_STRICT` 제거 + BuildState godoc
- `registry.go` — `strictModeEnvVar` / `strictGateEnabled()` + `os` / `strings` import 제거. `Register()` panic gate 항상 활성.
- `factory.go` (`BuildModules`) — env 분기 제거, 런타임 gate 상시 동작.
- `types.go` (`BuildModuleStateFor`) — godoc 에서 MMP_PLAYERAWARE_STRICT 언급 제거, "fallback 은 명시적 public 모듈에만 실행" 명확화.
- `phase_engine.go` (`PhaseEngine.BuildState`) — `SECURITY — internal/persistence only` godoc 블록 추가. 합법 caller 2 종(SaveState / admin fixture) 명시.
- `gate_test.go` — env-dependent 테스트 2 개 제거(`TestRegister_StrictModeDisabled_DoesNotPanic`, `TestStrictGateEnabled_Defaults`).
- `CLAUDE.md` — 하네스 변경 이력에 2026-04-18 PR-A 행 추가 + §모듈 시스템 rollback env 문구 갱신.
- `.claude/skills/mmp-module-factory/SKILL.md` §6 PlayerAware 게이트 문구 갱신.
- **Diff: 7 files · +55 / -101 (net -46 LOC)**
- **해소:** MEDIUM "strict env 제거 가능" + "BuildState godoc+승격 검토"

### PR-B #112 (e3cb866) — coverage lint AST 재작성
- `apps/server/cmd/playeraware-lint/main.go` (신규, 221 LOC) — `go/parser` + `go/ast` walker. BuildStateFor 본문의 수신자 메서드 호출에서 `BuildState` / `snapshot` 탐지.
- `apps/server/cmd/playeraware-lint/main_test.go` (신규, 198 LOC) — 인라인 fixture 6 case (ok 2 + bad 4) + `parseAllowList` + `receiverHelpers` 보조 테스트.
- `scripts/check-playeraware-coverage.sh` — awk/grep 로직 제거, `go run ./cmd/playeraware-lint` 호출 shim 으로 교체.
- **4 우회 패턴 차단:**
  1. `return m.BuildState()` literal (기존)
  2. `data, err := m.BuildState(); return data, err` (2-line capture)
  3. `return json.Marshal(m.snapshot())` (whole-state marshal)
  4. 3+ 줄 BuildStateFor body 내 `m.BuildState()` 위치 무관
- `.github/workflows/ci.yml` — 호출 shell wrapper 경로 그대로, 수정 없음.
- **Diff: 3 files · +436 / -64**
- **해소:** MEDIUM "coverage lint regex 우회 가능"

### PR-C #113 (4fe835f) — session 통합 테스트 + 3+ players table + PeerLeakAssert helper
- `apps/server/internal/engine/testutil/redaction.go` (신규, 45 LOC) — `PeerLeakAssert` + `AssertContainsCaller` cross-package helper. engine/ 외부 서브패키지로 배치해 combination · session · module 테스트 모두 cycle 없이 import 가능.
- `apps/server/internal/engine/testutil/redaction_test.go` (신규, 64 LOC) — `testing.T` spy 기반 self-test 4 케이스.
- `apps/server/internal/module/crime_scene/combination/combination_test.go` — 3 통합 테스트 +145 LOC:
  - `TestCombinationModule_BuildStateFor_ThreePlayersTable_NoPeerLeak` — alice/bob/charlie 3 player matrix + zero-state charlie subtest.
  - `TestCombinationModule_BuildStateFor_AfterRestoreState_PreservesRedaction` — SaveState → Restore → BuildStateFor 각 플레이어 redaction 회귀 방지.
  - `TestCombinationModule_BuildStateFor_ViaEngineDispatch` — `engine.BuildModuleStateFor` dispatch pin (PlayerAware vs BuildState fallback).
- **설계 차이:** `session/snapshot_redaction_test.go` 대신 `engine.BuildModuleStateFor` 레벨에서 등가 회귀 테스트. 이유는 `SessionManager.Start` 가 nil module list 로 PhaseEngine 만들어 real CombinationModule 주입 불가. session layer 는 기존 `TestSnapshot_TwoReconnectsBothViaActor` 가 actor path 커버.
- **Diff: 3 files · +262 / -0**
- **해소:** LOW "session 통합 테스트 부재" + "3+ players matrix" + "helper export"

## 남은 follow-up (리뷰 잔여분 — 별도 Phase 또는 백로그)

- **LOW** `jsonIsEmptyShape` 중복 / `EmptyForNewPlayer` 중복 guard 정리 — cosmetic, Phase 20 정리 시점 가능.
- **MEDIUM** PhaseEngine.BuildState 를 unexported + 서브패키지 이동 — PR-A godoc 으로 1차 방어, 구조 변경은 별도 refactor phase.
- PR-5 Coverage+mockgen (XL, High) · PR-9 WS Auth · PR-10 Runtime validation · editor/handler 분할 — 각자 별 Phase 승격.

## 검증 총결

- `go test -race -count=1 ./internal/engine/... ./internal/module/... ./internal/session/...` — 17 패키지 전건 green
- `go vet ./...` + `go build ./...` — exit 0
- `bash scripts/check-playeraware-coverage.sh` — clean (AST lint 경유)
- W1 session 재시작 없이 A → B → C 순차 머지 + 모든 CI admin-squash 완료

## 참조

- 설계: `docs/plans/2026-04-18-phase-19-1-audit-followups/design.md`
- 체크리스트: `docs/plans/2026-04-18-phase-19-1-audit-followups/checklist.md`
- PR 스펙: `refs/pr-a.md` / `refs/pr-b.md` / `refs/pr-c.md`
- Phase 19 archive: `docs/plans/2026-04-17-platform-deep-audit/`
- 선행 progress: `memory/project_phase19_implementation_progress.md` §PR-2c 사후 4-agent 코드리뷰 요약

## 다음 세션 재개

Phase 19.1 /plan-finish 완료 후 active plan 없음. 다음 phase 시작 시 `/plan-new <topic>` 로 신규 plan 작성.

차기 후보 (독립 phase 로 승격):
- PR-5 Coverage+mockgen (XL, High) — editor coverage -2.9pp 회귀 복구 + CI 75% hard-fail
- PR-9 WS Auth Protocol (L, Med) — IDENTIFY/RESUME/CHALLENGE/REVOKE
- PR-10 Runtime Payload Validation (L, Med) — Go struct → JSON Schema → zod
- editor/handler.go 624 · media_service.go 653 분할 refactor
