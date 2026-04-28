---
description: PR 구현 단계 진입점. worktree 분기(superpowers:using-git-worktrees) → file-type 감지 → tdd-mmp-go/react 활성 → OMC executor (sonnet-4-6) 위임 → 자동 post-test. 자동 머지/PR 생성 X.
allowed-tools: Bash, Read, Write, Edit, Skill, Task, Glob
argument-hint: "<pr-id> [--dry-run]   예: /compound-work PR-1"
---

# /compound-work

PR 구현 시 진입. **worktree + TDD soft ask + OMC executor 위임 + 자동 post-test**를 단계 시퀀스로 호출. 산출은 **구현 + 로컬 테스트 통과**까지 — 자동 머지·자동 PR 생성·자동 admin-merge 모두 금지 (anti-pattern).

> **카논 single source**: plan § "/compound-work 사양" + `refs/tdd-enforcement.md` + `memory/feedback_sonnet_46_default.md` + `refs/mandatory-slots-canon.md`.

## 인자

- `<pr-id>` (필수) — `^PR-[0-9]+[a-z]?$` 정규식 매칭. 화이트리스트 외 거부 (helper exit 2).
- `--dry-run` (선택) — 단계 시퀀스 JSON만 stdout 출력. 실제 worktree·skill·executor 호출 없음.

## 환경 변수

- `ACTIVE_PHASE` (필수) — 활성 phase 디렉토리. 메인 컨텍스트가 `ls -td docs/plans/*/ | head -1`로 자동 검출 또는 사용자 명시 override.
- `PROJECT_SLUG` (선택, default `${ACTIVE_PHASE##*/}`) — branch prefix 카논. plugin work 시 `compound-mmp` 명시 (sister 카논 align — memory/sessions 7건). phase work 시 default(phase basename)로 충분. 화이트리스트 `^[a-z0-9_.-]+$`.
- `SCOPE` (기본 `go`) — `go` 또는 `react`. file-type 감지 결과를 helper에 전달.
- `BASE_BRANCH` (기본 `main`) — worktree 분기 base.

## 실행 시퀀스 (메인 컨텍스트)

### 1. dry-run helper 호출 → 단계 시퀀스 JSON

```bash
ACTIVE_PHASE="$ACTIVE_PHASE" SCOPE="$SCOPE" BASE_BRANCH="$BASE_BRANCH" \
  bash .claude/plugins/compound-mmp/scripts/compound-work-dry-run.sh "$PR_ID"
```

stdout: `{pr_id, worktree, tdd_skill, executor, post_test, mandatory_slots}` (jq parsable).

`--dry-run` 모드 종료. 정상 모드는 helper output 따라 순차 진행.

### 2. helper 단계를 imperative iterate

| 필드 | 메인 컨텍스트 행동 |
|------|-------------------|
| `worktree.skill` | `Skill superpowers:using-git-worktrees` 호출. args = `{branch: helper.worktree.branch, base: helper.worktree.base}`. worktree 디렉토리 진입. |
| `tdd_skill` | `Skill <helper.tdd_skill>` 호출. `compound-mmp:tdd-mmp-go` 또는 `compound-mmp:tdd-mmp-react`. `pre-edit-size-check.sh` PreToolUse hook이 `*_test.go`/`*.test.tsx` 부재 시 soft ask. |
| `executor` | `Task` tool 호출. `subagent_type=helper.executor.subagent_type`, `model=helper.executor.model`. **반드시 `claude-sonnet-4-6`** — `pre-task-model-guard.sh` PreToolUse(Task) hook이 4.5 차단. helper 카논으로 보호. |
| `post_test` | `Bash` tool 호출. `helper.post_test` 명령 실행. 실패 시 사용자에게 보고 + 결정 대기 (자동 fix-loop 금지). |
| `mandatory_slots` | M-N1 sister 카논 (`refs/mandatory-slots-canon.md`). `tdd-test-first` 슬롯이 `tdd_skill` 호출에 inject되어야 함. 누락 시 wrap-up Step 1이 검출. |

> **OMC fallback** (helper.executor.subagent_type 미가용 시): `oh-my-claudecode:executor` → `general-purpose` (sonnet-4-6 명시). 본 repo는 OMC user-home 카논 — 신규 환경에서 `general-purpose` 폴백 활성. review-mmp/SKILL.md fallback 표 대칭.

### 3. 사용자 보고 게이트 (CRITICAL — 자동 머지 금지)

post-test 통과 후 **반드시 멈춘다**. 메인 컨텍스트는 다음 형식으로 사용자에게 보고:

```
구현 + post-test 통과: <PR-ID>
worktree: <branch> (base <base>)
변경 파일: <list>
다음 작업 후보:
  - /compound-review <PR-ID>     (4-agent 병렬 리뷰)
  - 추가 수정                     (사용자 결정)
  - git push + PR 생성            (사용자 결정)
```

**자동으로 push/PR/admin-merge 진행 X**. anti-pattern (`refs/anti-patterns.md` § "자동 다음 단계 진입").

## Anti-pattern (helper/fixture가 차단)

- ❌ pr-id 화이트리스트 우회 → helper exit 2
- ❌ SCOPE `go`/`react` 외 값 → helper exit 2
- ❌ ACTIVE_PHASE 미설정 또는 디렉토리 부재 → helper exit 3
- ❌ executor.model 에 `sonnet-4-5` 포함 → fixture 차단 + Task hook 차단 (이중 안전망)
- ❌ helper output에 `admin-merge`/`auto-merge`/`gh pr merge` 토큰 → fixture 차단 (자동 머지 금지)
- ❌ post-test 실패 시 자동 재시도 또는 fix-loop → 사용자 결정 대기 카논
- ❌ tdd_skill 호출 생략 → wrap-up Step 1이 mandatory_slots 검출

## 사용 예

```
사용자: /compound-work PR-1
메인:
  1. helper 실행 → JSON {worktree, tdd_skill, executor, post_test, mandatory_slots}
  2. Skill superpowers:using-git-worktrees (worktree 분기)
  3. Skill compound-mmp:tdd-mmp-go (TDD soft ask 활성)
  4. Task oh-my-claudecode:executor (sonnet-4-6) — 구현 위임
  5. Bash "cd apps/server && go test -race ./internal/..."
  6. 사용자 보고 (자동 머지 X)
사용자: 4-agent 리뷰 진행, /compound-review PR-1
```

## 검증 (test-compound-work-dry-run.sh, 31 case)

helper 직접 실행 → JSON contract 검증. 입력 화이트리스트 (6 case) / 정상 입력 (2 case) / JSON 구조 (6 case) / worktree (3 case) / tdd 매핑 (3 case) / executor (3 case, sonnet-4-5 차단 검증 포함) / post_test (2 case) / 자동 머지 금지 (1 case) / mandatory_slots (2 case) / env (3 case).

CI: `.github/workflows/ci-hooks.yml` ubuntu+macOS 양쪽 fixture 실행. `compound-review-dry-run.sh`/`compound-plan-dry-run.sh` sister 카논.
