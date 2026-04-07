# PR-0: Docs + plan-autopilot infra

> Wave 0 (sequential) | 의존: 없음

## 목적
Phase 8.0 문서 + plan-autopilot 스킬 설치 + 메모리 업데이트를 단일 PR로 머지.

## Tasks
- [x] design.md refactor to index + refs (각 <200줄)
- [x] refs/scope-and-decisions.md
- [x] refs/architecture.md
- [x] refs/data-flow.md
- [x] refs/persistence.md
- [x] refs/execution-model.md (wave DAG)
- [x] refs/observability-testing.md
- [x] memory/project_phase80_plan.md (wave 반영)
- [x] memory/project_phase80_progress.md (wave 반영)
- [x] memory/MEMORY.md (Phase 8.0 pointer)
- [x] ~/.claude/skills/plan-autopilot/ 전체 skill 생성
- [x] .claude/ 설치 (scripts symlinks, commands copy, settings, pipeline)
- [x] .claude/active-plan.json 초기화
- [x] CLAUDE.md "Active Plan Workflow" 섹션 추가
- [x] docs/plans/2026-04-08-engine-integration/checklist.md 최초 생성
- [x] plan.md + refs/pr-0~9-*.md (이 파일 포함)
- [ ] 루트 checklist.md Phase 8.0 추가 + Phase 8 → 8.1 rename
- [ ] PR-0 commit + push + create PR

## Files (스코프)
- `docs/plans/2026-04-08-engine-integration/**`
- `.claude/**`
- `CLAUDE.md`
- `memory/**`
- `docs/plans/2026-04-05-rebuild/checklist.md` (root)

## Test coverage
- 문서 PR이라 코드 테스트 없음
- 검증:
  - 모든 .md 파일 < 200 lines (`find docs/plans/2026-04-08-engine-integration -name '*.md' | xargs wc -l | awk '$1>200'` → 0)
  - `.claude/scripts/plan-status.sh --compact` 정상 출력
  - `.claude/scripts/plan-status.sh --verbose` STATUS 마커 포함
  - `jq . .claude/active-plan.json` valid
  - `jq . .claude/post-task-pipeline.json` valid

## Definition of done
- 모든 tasks ✅
- `git status` clean
- PR-0 commit 메시지 형식: `docs(phase-8.0): add design + plan-autopilot infra`
- 루트 checklist.md에 "Phase 8.0" 추가됨
- CLAUDE.md에 Active Plan Workflow 섹션 포함
