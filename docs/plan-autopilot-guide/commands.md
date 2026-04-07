# 슬래시 커맨드 상세

> 부모: [../../PLAN_AUTOPILOT.md](../../PLAN_AUTOPILOT.md)

## 전체 목록

| 커맨드 | 빈도 | 용도 |
|--------|------|------|
| `/plan-new <topic>` | phase당 1회 | 새 phase 저작 |
| `/plan-start <dir>` | phase당 1회 | 플랜 활성화 |
| `/plan-autopilot [opts]` | 작업 시작 | Wave 자동 실행 |
| `/plan-stop` | 필요 시 | 실행 중단 |
| `/plan-status` | 자주 | 빠른 상태 확인 |
| `/plan-tasks` | 자주 | 진행률 트리 |
| `/plan-resume` | /clear 후 | 컨텍스트 복원 |
| `/plan-finish` | phase 종료 | archive |

## `/plan-new <topic>`

새 phase 플랜을 3단계로 저작.

**Stage 1**: `superpowers:brainstorming` (Opus) — 7가지 설계 결정 수집
**Stage 2**: `superpowers:writing-plans` — PR breakdown + wave DAG
**Stage 3**: 템플릿 기반 docs 생성 (<200줄 강제)

**7가지 결정**:
1. Scope boundary (in/out)
2. Architecture pattern
3. Lifecycle (create/destroy/transition)
4. External interface
5. Persistence/state
6. Operational safety (panic, observability, tests)
7. Rollout strategy (feature flag + waves)

**출력**:
```
docs/plans/YYYY-MM-DD-<slug>/
  design.md (index)
  plan.md (index)
  checklist.md (STATUS marker)
  refs/
    scope-and-decisions.md
    architecture.md
    execution-model.md (wave DAG)
    observability-testing.md
    pr-1-*.md ~ pr-N-*.md
```

## `/plan-start <plan-dir>`

플랜 디렉터리를 active로 등록.

**동작**:
1. `<dir>/design.md`, `plan.md`, `checklist.md` 읽기
2. STATUS 마커 존재 검증
3. 기존 `.claude/active-plan.json`이 있으면 archive 확인
4. 새 active-plan.json 작성 (scope, waves, PRs 필드)

**효과**: 이 시점부터 모든 hook이 활성화됩니다.

## `/plan-autopilot [opts]`

Wave 기반 자동 실행 루프.

**옵션**:
- `--until WAVE` — 특정 wave까지만
- `--only PR-N` — 특정 PR만
- `--dry-run` — manifest만 출력, 실행 안 함

**흐름**:
```
For each wave in active-plan.json.waves:
  1. Pre-wave checks (deps, scope overlap validation)
  2. Spawn agents (parallel=multi Agent in ONE message + isolation:worktree)
  3. Collect results
  4. Sequential merge + test gate
  5. User confirm 1회
  6. Advance wave pointer
After last wave: run after_plan pipeline → /plan-finish
```

**각 sub-agent 내부**:
```
Read design + checklist PR section
For each task: implement + atomic commit + mark ✅
After all tasks:
  format + scope-test + full-test + lint
  4 parallel reviewers (security, perf, arch, test-coverage)
  fix-loop (max 3)
  commit + push + create PR
Return {pr_id, branch, commit_hash, status, findings}
```

## `/plan-stop`

실행 중인 autopilot을 중단.

**동작**:
1. `.claude/autopilot-state.json` 생성 (현재 wave, PR, 타임스탬프)
2. In-flight sub-agent는 현재 스텝 끝날 때까지 기다림
3. `active-plan.json`은 삭제되지 않음 (플랜은 살아있음)

재개: `/plan-resume` 또는 `/plan-autopilot`

## `/plan-status`

빠른 스냅샷. 3초 이내 출력.

**내용**:
- Phase 이름 + started
- Current wave / PR / task
- STATUS 마커 (checklist에서 추출)
- Scope 파일 목록
- Recent commits (last 5)
- Uncommitted changes
- 다음 추천 action

실행: `~/.claude/skills/plan-autopilot/scripts/plan-status.sh --verbose`

## `/plan-tasks`

시각적 진행률 트리.

**내용**:
- Overall progress bar (%)
- Wave 별 상태 아이콘 (✅🔄⏸)
- PR 별 task 개수 + 완료율
- 현재 task 하이라이트

실행: `~/.claude/skills/plan-autopilot/scripts/plan-tasks.sh`

## `/plan-resume`

완전한 context 복원. `/clear` 후 특히 유용.

**읽는 파일** (모두 parallel):
- `<plan.design>` (index + refs/ 전부)
- `<plan.plan>`
- `<plan.checklist>`
- `<plan.progress_memory>`
- 현재 PR의 `refs/pr-<current_pr>-*.md`
- `.claude/post-task-pipeline.json`
- `.claude/autopilot-state.json` (있으면)

**+ git 데이터**: log -10, status, branch

**효과**: design + checklist 읽기로 **PreToolUse guard 자동 해제** (30분 유효).

## `/plan-finish`

Phase 종료 archive.

**동작**:
1. 모든 task ✅ 확인 (아니면 force 확인)
2. 완료 metadata 추가 (finished_at, final_commit)
3. `.claude/active-plan.json` → `.claude/archived_plans/<id>.json` 이동
4. 루트 checklist 갱신 (phase ✅ 마킹)
5. 메모리 파일 갱신
6. commit 제안

**효과**: 모든 hook 자동 비활성화. 워크플로우가 일반 모드로 복귀.
