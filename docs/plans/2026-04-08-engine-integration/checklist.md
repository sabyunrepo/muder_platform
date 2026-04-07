<!-- STATUS-START -->
**Active**: Phase 8.0 — Engine Integration Layer — Wave 0/5 (doc+infra)
**PR**: PR-0 (docs + plan-autopilot install)
**Task**: Create plan.md + checklist refs + commit PR-0
**State**: in_progress
**Blockers**: none
**Last updated**: 2026-04-08
<!-- STATUS-END -->

# Phase 8.0 — Engine Integration Layer 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md) (작성 예정)

이 파일은 진행 상태 tracking. STATUS 마커는 hook/스크립트가 파싱하므로 형식 유지.
PR별 상세 task는 plan.md + refs/pr-N-*.md 완성 후 이 파일에도 반영됨.

---

## Wave 0 — 문서 + 인프라 (현재)

- [x] design.md refactor to index + refs (각 <200줄)
- [x] memory files wave 정보 반영
- [x] plan-autopilot 스킬 생성 (~/.claude/skills/plan-autopilot/)
- [x] 프로젝트에 스킬 설치 (.claude/scripts, commands, settings, pipeline)
- [x] .claude/active-plan.json 초기화
- [ ] plan.md + refs/pr-N-*.md 작성 (task #47)
- [ ] checklist.md의 Wave 1~5 섹션 확장 (task #47)
- [ ] 루트 checklist.md에 Phase 8.0 추가 + Phase 8을 8.1로 rename (task #48)
- [ ] CLAUDE.md에 Active Plan Workflow 섹션 추가
- [ ] PR-0 commit (task #49)

---

## Wave 1 — Skeletons (parallel ×2)

### PR-1: SessionManager + Session actor
*상세 task는 refs/pr-1-skeleton.md 참조 (작성 예정)*

### PR-2: Hub lifecycle listener
*상세 task는 refs/pr-2-hub-lifecycle.md 참조 (작성 예정)*

**Wave 1 gate**:
- [ ] PR-1, PR-2 모든 task ✅
- [ ] 4-reviewer 병렬 리뷰 pass
- [ ] Fix-loop < 3회
- [ ] `go test -race ./...` pass
- [ ] Merge to main
- [ ] User confirmed → Wave 2 진입

---

## Wave 2 — 인프라 (sequential)

### PR-3: BaseModuleHandler + EventMapping 인프라
*상세 task는 refs/pr-3-base-handler.md 참조*

**Wave 2 gate**: 위와 동일 패턴

---

## Wave 3 — 패턴 레퍼런스 (sequential)

### PR-4: Reading 모듈 wired
*상세 task는 refs/pr-4-reading-wired.md 참조*

**Wave 3 gate**: 이 PR이 후속 모든 모듈 wiring의 패턴 확정

---

## Wave 4 — 병렬 wiring (parallel ×4)

### PR-5: Core 4 modules (connection, room, ready, clue_interaction)
### PR-6: Progression 7 modules (script, hybrid, event, skip_consensus, gm_control, consensus_control, ending)
### PR-7: Redis snapshot + Lazy restore
### PR-8: Game start API + abort + idle timeout

*상세 task는 refs/pr-5-*.md ~ refs/pr-8-*.md 참조*

**Wave 4 gate**: 파일 스코프 겹침 검증 + 순차 머지 + test gate

---

## Wave 5 — Observability (sequential)

### PR-9: Prometheus metrics + OTel spans + alarm stubs

**Wave 5 gate**: metric scrape test + 종료 전 최종 검증

---

## Phase completion gate

- [ ] 모든 5 waves ✅
- [ ] Feature flag `MMP_ENGINE_WIRING_ENABLED` 활성 상태에서 통합 테스트 PASS
- [ ] 12개 모듈 smoke test PASS
- [ ] e2e 시나리오 통과
- [ ] Restart recovery + panic isolation 시나리오 통과
- [ ] Prometheus metric 9종 scrape 가능
- [ ] `project_phase80_progress.md` 최종 갱신
- [ ] 루트 `docs/plans/2026-04-05-rebuild/checklist.md` "Phase 8.0 ✅"
- [ ] `/plan-finish` 실행 → archive
- [ ] Phase 8.0.x 후속 plan 작성 여부 결정 (17 모듈 wiring)
