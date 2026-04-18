# Phase 19.1 — Audit Review Follow-ups (설계)

> **승격 근거**: Phase 19 implementation 완료(P0 7/7) + PR-2c(#107) 사후 4-agent 코드리뷰 결과 HIGH 1건(#108 해소) + MEDIUM 4건 + LOW 5+건.
> Phase 19 종결(archived 2026-04-18) 후 리뷰 잔여분만 타이트하게 묶은 후속 phase.

## 목적

PR-2c 사후 리뷰에서 발견된 **review-driven** 잔여 이슈를 단일 wave 3 PR 로 빠르게 소화한다. 기능 신규 PR(PR-5/PR-9/PR-10) 및 기존 tech debt(editor handler 분할) 는 **포함하지 않는다** — 별도 Phase 로 승격.

## 범위 (scope-tight)

| PR | 출처 리뷰 findings | Size | Risk | 우선도 |
|----|---------------------|------|------|-----|
| **PR-A** | MEDIUM — `MMP_PLAYERAWARE_STRICT` env 제거 + `PhaseEngine.BuildState()` godoc+승격 검토 | S | Med | P1 |
| **PR-B** | MEDIUM — `scripts/check-playeraware-coverage.sh` AST 기반 재작성 (`m.snapshot()` 전체 marshal · 간접 delegate · 2줄 delegate 우회 차단) | M | Low | P2 |
| **PR-C** | LOW — `session/snapshot_redaction_test.go::TestSnapshot_Redaction_CombinationCrafted` 통합 테스트 + 3+ players table + `engine/testutil/redaction.go` 로 `peerLeakAssert` helper export | M | Med | P2 |

**의도적으로 제외:**
- PR-5 Coverage+mockgen (XL, High) — 별도 Phase 승격. mockgen 도입이 기존 unit 테스트 대부분 재작성 필요.
- PR-9 WS Auth / PR-10 Runtime validation — PR-1 이후 파생 feature, 독립 phase.
- editor/handler.go 624 · media_service.go 653 분할 — PR-4a scope 외, 별도 tech-debt phase.

## Wave 구조 (단일 wave)

### W1 — Audit Review Follow-up (병렬 3)
| PR | depends_on | 파일 |
|----|-----------|------|
| PR-A | (none) | `apps/server/internal/engine/registry.go` · `apps/server/internal/engine/phase_engine.go` · (module `init`) |
| PR-B | (none) | `scripts/check-playeraware-coverage.sh` |
| PR-C | (none) | `apps/server/internal/session/snapshot_redaction_test.go` · `apps/server/internal/engine/testutil/redaction.go` (신규) · `apps/server/internal/module/crime_scene/combination/combination_test.go` (table-driven 통합) |

**Gate**: 3 PR 전부 main 머지 + `go test -race` green + coverage lint green.

**병렬 가능**: 3 PR 의 파일 touchset 이 disjoint (engine vs scripts vs session/testutil). worktree 안 쓰고 순차 브랜치 + `gh pr create` 3회로 진행 가능.

## 산출물

- `refs/pr-a.md` · `refs/pr-b.md` · `refs/pr-c.md` (≤200줄)
- `checklist.md` (STATUS 마커 포함)
- `memory/project_phase19_1_progress.md` (진행 로그)

## 종료 조건

- [ ] PR-A · PR-B · PR-C 전부 main 머지 + CI green (admin-skip 2026-05-01까지)
- [ ] 4-agent 사후 리뷰 MEDIUM 2건 + LOW 1건(통합 테스트) 해소 기록
- [ ] `memory/project_phase19_1_progress.md` frontmatter 완료 + MEMORY.md 인덱스 갱신
- [ ] `/plan-finish` Phase 19.1 후 Phase 19 archive 와 동일하게 decoupling

## 참조

- Phase 19 archive: `docs/plans/2026-04-17-platform-deep-audit/`
- 사후 리뷰 요약: `memory/project_phase19_implementation_progress.md` §PR-2c 사후 4-agent 코드리뷰 요약
- PR-2c 머지 커밋: `0b31271` (#107) / `59a39c4` (#108) / `099a096` (#109 progress sync)
