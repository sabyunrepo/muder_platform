# Phase 19.1 — Audit Review Follow-ups (체크리스트)

<!-- STATUS-START -->
**Active**: Phase 19.1 Audit Review Follow-ups
**Wave**: W1 (단일 wave, 병렬 3)
**Task**: PR-A MMP_PLAYERAWARE_STRICT 제거 + BuildState godoc / PR-B coverage lint AST 재작성 / PR-C session 통합 테스트 + testutil helper export
**State**: ready
**Blockers**: 없음 (Phase 19 archived 2026-04-18)
**Last updated**: 2026-04-18
<!-- STATUS-END -->

## W1 — Audit Review Follow-up (병렬 3)

### PR-A — `MMP_PLAYERAWARE_STRICT` 제거 + `PhaseEngine.BuildState()` godoc
- [ ] `apps/server/internal/engine/registry.go` — `strictGateEnabled()` 함수 및 `MMP_PLAYERAWARE_STRICT` env 처리 삭제
- [ ] `apps/server/internal/engine/registry.go` — `Register()` panic gate 가 env 여부 없이 항상 활성
- [ ] `apps/server/internal/engine/phase_engine.go` — `BuildState()` godoc 에 "internal/persistence only — client broadcast MUST use BuildStateFor" 명시
- [ ] 관련 테스트(`engine/gate_test.go` strict env 분기 제거, 기존 assert 로직 유지)
- [ ] `go test -race` + vet + coverage lint green

### PR-B — coverage lint AST 재작성
- [ ] `scripts/check-playeraware-coverage.sh` Go AST 기반 (`go run ./scripts/cmd/playeraware-lint/main.go` 형태) 또는 `-A5` + `m\.snapshot\(\)` 금지 패턴 추가
- [ ] 차단 대상 정식화:
  - 기존: `return m.BuildState()` literal
  - 추가: `return m.buildStateInner()`, `data, err := m.BuildState(); return data, err`, `return json.Marshal(m.snapshot())`
- [ ] 의도적 public 모듈(`PublicStateMarker` 임베드) 은 lint 대상 제외 확인
- [ ] CI step (`.github/workflows/ci.yml`) 에서 새 lint 호출 경로 교체
- [ ] `go test` + lint 통과 검증 (self-test: 일부러 3 가지 우회 패턴을 테스트 모듈에 넣어 lint 가 잡는지 확인)

### PR-C — session 통합 테스트 + 3+ players table + helper export
- [ ] `apps/server/internal/engine/testutil/redaction.go` 신규 — `PeerLeakAssert(t, raw, caller, peers...)` helper
- [ ] `apps/server/internal/session/snapshot_redaction_test.go::TestSnapshot_Redaction_CombinationCrafted` 신규 — 2~3 player 세션에서 combine → snapshot 브로드캐스트 → bob 의 derived 가 alice payload 에 미출현 검증
- [ ] `combination/combination_test.go` — 기존 3 BuildStateFor 테스트를 table-driven (`[]struct { name string, setup func, caller/peers }`) 로 통합, `PeerLeakAssert` 재사용
- [ ] 3+ players matrix (alice, bob, charlie) 케이스 추가
- [ ] RestoreState 직후 BuildStateFor 경로 테스트 추가
- [ ] `go test -race` + coverage lint green

## 종료 조건

- [ ] W1 3 PR 전부 main 머지 + `gh pr merge --admin --squash`
- [ ] `memory/project_phase19_1_progress.md` 완료 표시 + MEMORY.md 엔트리 update
- [ ] `/plan-finish` Phase 19.1 → archive

## 참조

- 설계: `design.md` (이 파일 인접)
- PR 스펙: `refs/pr-a.md` · `refs/pr-b.md` · `refs/pr-c.md`
- Phase 19 archive: `docs/plans/2026-04-17-platform-deep-audit/`
- 리뷰 요약: `memory/project_phase19_implementation_progress.md` §PR-2c 사후 4-agent 코드리뷰 요약
