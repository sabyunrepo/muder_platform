---
topic: "compound-mmp Wave 3 PR-7 — /compound-review + 4-agent parallel review bridge 머지"
phase: "Wave 3 진입 (PR-7 완료) → PR-8 `/compound-plan` 대기"
prs_touched: [PR-#158]
session_date: 2026-04-28
---

# Session Handoff: Wave 3 PR-7 /compound-review + 4-agent bridge 완료

## Decided

- **PR #158 머지 (`b5e4127`)** — `/compound-review [pr-id] [--dry-run]` 슬래시 + `scripts/compound-review-dry-run.sh` helper + 27-case fixture + `templates/review-result-template.md` + ci-hooks workflow 확장. squash + branch 자동 삭제.
- **Q-shopt phantom 폐기** (memory/QUESTIONS.md strikethrough) — `test-dispatch.sh` 41/41 + 격리 subshell `shopt -s/-u nocasematch` 누수 0 확인. trap RETURN 보강 불필요.
- **HIGH 4건 fix in-PR** — 4-agent self-review round-1에서 발견 → admin-merge 전 즉시 처리 (PR-2c #107 사고 패턴 회피). round-2(arch+test) 모두 RESOLVED + 신규 HIGH/MED 0건.
  - HIGH-A1: 슬래시 본문 4 Task 하드코딩 → `iterate over helper.payload[]` imperative
  - HIGH-A2: OMC fallback 매핑 표 § 4.1 추가 (general-purpose + superpowers:code-reviewer)
  - HIGH-A3: dispatch fixture +6 phrase + "audit this" false positive 회피로 본문 제거
  - HIGH-T1: case 21 (`sabyun` 하드코딩) 제거 + MED-T1 `{pr_title}/{design}` 검증 +4
- **MED-P1+P2 helper fork 5→3** — `${BASH_SOURCE[0]%/*}` (2 fork 절감) + `[[ =~ ]]` (1 fork 절감). sister `pre-task-model-guard.sh` 1 fork에 가까워짐.
- **OMC fallback 카논화** — `oh-my-claudecode:*` 4 agent 모두 user-home `~/.claude/plugins/`에 위치, 본 repo는 모름. 가용성 체크 + fallback 매핑 슬래시 본문에 명시 (이번 PR scope에 포함).
- **CI admin-skip 정책 활성** — 2026-05-01 만료 (D-3). 이번 PR도 admin-merge로 진행, ci-hooks workflow는 머지 후 main에서 첫 실행.

## Rejected

- ~~`/compound-review` HIGH 자동 fix-loop~~ — 사용자 결정 대기 카논 유지 (refs/post-task-pipeline-bridge.md § "자동 fix-loop 금지", PR-2c #107 사고 정책)
- ~~"audit this" 매칭을 위해 dispatch-router 정규식 보강~~ — false positive 위험 ("audit log 추가" → review 오라우팅). 본문 제거가 최소 범위. MISTAKES NEW로 카논화.
- ~~`length == 4` runtime self-validate (MED-A4)~~ → PR-9 piggyback (helper 로직 변경이라 worktree 통합과 묶음). 본 PR fixture에만 contract.
- ~~별도 hygiene PR~~ — Quick Wins (MED-A1 architect 정정 + MED-A2 review-mmp SKILL) PR-8 piggyback이 followup-suggester 권고

## Risks

- **CI admin-skip 만료 D-3 (2026-05-01)** — PR-8 진행 중 정식 CI 첫 실행. golangci-lint↔Go1.25 + ESLint9 config 미흡 (main도 fail) 사전 정비 필요 가능. `feedback_ci_infra_debt.md` 참조.
- **carry-over 누적** — 본 세션 신규 6건 (LOW-T3 / MED-A1~A4 / MED edge cases) + 이전 세션 8건 = 총 14건. 다음 세션 wrap에서 가시성 부담. PR-8(Quick Wins 2) + PR-9(MED-A3/A4 + edge cases) + PR-10(LOW 묶음) 분산 권고.
- **graphify-out 미커밋** — 정책 D 유지 (일상 commit 금지). wrap 시점 명시 무시 카논.
- **OMC plugin 미설치 환경** — 본 repo는 OMC가 user-home에 있어 신규 클론·CI 환경에서 `/compound-review` 실행 시 fallback 매핑이 활성화되어야 함. 카논 § 4.1에 명시했으나 실제 동작은 PR-9 dogfooding에서 검증.

## Files

### 이번 세션 main 변경 (PR #158, `b5e4127`)
- NEW: `.claude/plugins/compound-mmp/commands/compound-review.md` (146줄)
- NEW: `.claude/plugins/compound-mmp/scripts/compound-review-dry-run.sh` (72줄)
- NEW: `.claude/plugins/compound-mmp/hooks/test-compound-review-dry-run.sh` (178줄, 27 case)
- NEW: `.claude/plugins/compound-mmp/templates/review-result-template.md` (76줄)
- NEW: `docs/plans/2026-04-28-compound-mmp-wave3/refs/reviews/PR-7.md` (141줄, round-1+round-2 자가 리뷰 결과)
- MOD: `.claude/plugins/compound-mmp/hooks/test-dispatch.sh` (+10줄, +6 phrase fixture)
- MOD: `.github/workflows/ci-hooks.yml` (+12줄, shellcheck scripts/ + ubuntu+macOS step)
- MOD: `memory/QUESTIONS.md` (Q-shopt strikethrough)

### 이번 wrap에서 main 변경 (별도 commit 예정)
- NEW: `memory/sessions/2026-04-28-compound-mmp-wave3-pr7.md` (이 파일)
- MOD: `memory/MEMORY.md` (Wave 3 PR-7 + audit-removal pattern entry 2건 추가)
- (사용자 승인 시) NEW: `memory/MISTAKES.md` (NEW 1건 — dispatch-router audit 제거 패턴)

### 미생성 (다음 wrap 또는 PR에서)
- `memory/MISTAKES.md` 신규 생성 — 사용자 승인 대기 (Step 6-1)
- `skills/review-mmp/SKILL.md` (PR-8 Quick Win, MED-A2)

## Remaining

### Wave 3 PR-8 spec (즉시 — 다음 세션 main 작업 후보)
- **PR-8** `/compound-plan <topic> [--from <previous-phase>]` + `qmd-recall` 스킬 — `superpowers:brainstorming` → `writing-plans` 순차 + QMD `mmp-plans` vector_search 5건 자동 회상 → `docs/plans/<YYYY-MM-DD>-<topic>/checklist.md` 초안. 자동 PR 생성 X.
- **PR-8 piggyback (Quick Wins)**: MED-A1 architect→critic 정정 + MED-A2 `skills/review-mmp/SKILL.md` 신규 (compound-wrap SKILL 패턴 대칭).

### Carry-over 이번 PR-7 4-agent review에서 식별
- **MED-A3** helper `${SCRIPT_DIR}/../../../post-task-pipeline.json` 3-deep coupling — PR-9 piggyback (worktree 통합과 묶음)
- **MED-A4** helper length self-validate (현재 fixture에만 contract) — PR-9 piggyback
- **MED edge cases** jq missing → exit 5 path, pipeline.json malformed JSON 처리 — PR-10 dogfooding scope
- **LOW-T3** 슬래시 본문 "사용 예" L114 `length == 4` 하드코딩 — 인라인 주석 (PR-8/9/10 어디든)

### Carry-over 이전 세션 미해소 (PR-6 wrap)
- **MED-1** PATTERN 단어 경계 강화 (pre-task-model-guard `(claude-)?sonnet-4[-.]5` → `\b` 가산) — PR-10 또는 별도 hotfix
- **LOW-1** `trap 'shopt -u nocasematch' EXIT` 안전 패턴 — PR-9 piggyback
- **LOW-2** 파일명 어휘 통일 — PR-10
- **LOW-3** shellcheck SC2086 좁히기 — PR-9 또는 wrap
- **TEST-LOW 5건** — PR-10
- **Q-regex / Q-sim-c** — PR-10 dogfooding

### Wave 3 PR-9/PR-10 backlog (자동화 기회 NEW 4건)
- **HIGH** `/compound-review` Step 6 carry-over 자동 QUESTIONS append — PR-9 또는 별도 hook
- **MED** PostToolUse Bash matcher (dry-run JSON 계약 재검증) — PR-9
- **MED** `scripts/omc-check.sh` 공용 helper (`/compound-review` + `/compound-wrap` 양쪽 source) — PR-9
- **LOW** jq missing + malformed JSON edge case fixture — PR-10

## Next Session Priorities

1. **CI admin-skip 만료 D-3 (2026-05-01) 결정** — 세션 시작 즉시 결정 필요: (a) golangci-lint↔Go1.25 + ESLint9 fix 우선, (b) admin-skip 연장, (c) PR-8 이전 hotfix PR. `feedback_ci_infra_debt.md` 참조.
2. **Wave 3 PR-8 진입** — branch `feat/compound-mmp/PR-8-plan-command`. spec read: `~/.claude/plans/vivid-snuggling-pascal.md` § Wave 3 PR-7→PR-8. TDD: `qmd-recall` 스킬 helper 먼저.
3. **PR-8 Quick Wins piggyback** — MED-A1 architect→critic + MED-A2 `skills/review-mmp/SKILL.md` (Effort S 각 1건, diff 오염 최소).
4. **4-agent self-review 카논 유지** — round-1 background spawn → HIGH 발견 시 in-PR fix → round-2 (arch+test 또는 영향 영역만) 패턴이 효과적 (PR-7 검증).

## What we did

### `/compound-resume` 두 번째 dogfooding
사용자가 첫 발화로 `/compound-resume` 명시 호출. 가장 최근 mtime `memory/sessions/2026-04-28-compound-mmp-wave2-pr6.md` + plan vivid-snuggling-pascal.md § Wave 3 + 카논 cheat-sheet 일괄 read. 자동 SessionStart inject 폐기 결정 검증 (2026-04-28).

### Q-shopt phantom 검증
`test-dispatch.sh` 41/41 + 격리 subshell test (`shopt -s/-u nocasematch` 함수 외 누수 0) → PHANTOM 확정. dispatch-router.sh L42→L47, L51→L61, L67→L81 각 블록 명시적 짝 + exit 경로(L45)도 `-u` 통과. carry-over 폐기 + memory/QUESTIONS.md strikethrough.

### PR-7 TDD 사이클 (commit `24cd049`)
1. branch `feat/compound-mmp/PR-7-review-bridge` (origin/main 기준)
2. RED: `test-compound-review-dry-run.sh` 24-case fixture (입력 화이트리스트, JSON 계약, 4-agent 카논 매핑, injection 거부, 환경 검증). 헬퍼 부재 → 24/24 fail (exit 127).
3. GREEN: `compound-review-dry-run.sh` 50줄 — `set -eu`, jq guard, pr-id 화이트리스트(`^PR-[0-9]+[a-z]?$`), DESIGN_PATH/PIPELINE_PATH env, jq `--arg` 토큰 치환 (shell injection 차단 카논).
4. bash 3.2 호환 fix: `run_test`에 `return 0` 누락 → `set -e`로 첫 case 후 종료. 명시 `return 0` 추가 후 24/24 양쪽 pass.
5. `commands/compound-review.md` slash 본문 + `templates/review-result-template.md` + ci-hooks.yml 확장 (shellcheck scripts/* + ubuntu/macOS new step).

### 4-agent self-review round-1 (background spawn)
single message에 4 Agent tool 동시 spawn (run_in_background=true). agent_mapping: security/test = `general-purpose`, perf = `general-purpose` sonnet, arch = `superpowers:code-reviewer` opus (OMC 미가시 fallback). 결과:
- security PASS / perf PASS WITH CAVEATS (MED 2 fork 절감) / arch PASS WITH CAVEATS **HIGH 3** / test PASS WITH CAVEATS **HIGH 1**

### HIGH 4건 fix (commit `8717dce`)
- HIGH-A1 슬래시 § 4 imperative iterate (4 Task enum 제거)
- HIGH-A2 OMC fallback 매핑 표 § 4.1 추가 (4 agent 모두 + 모델 보존)
- HIGH-A3 test-dispatch.sh +6 phrase fixture (47/47), "audit this" false positive 회피로 본문 제거
- HIGH-T1 case 21 (`sabyun` 하드코딩) 제거 + MED-T1 `{pr_title}/{design}` 검증 +4 case (24→27)
- MED-P1+P2 helper fork 5→3 (`${BASH_SOURCE[0]%/*}` + `[[ =~ ]]`, bash 3.2 fallback 포함)

### 4-agent round-2 검증 + admin-merge
arch + test 2 agent background spawn (security/perf round-1 PASS 영역). 양쪽 "ready for admin-merge: YES", HIGH 0건 신규. round-2 결과 commit `d227332`로 reviews/PR-7.md 업데이트. `gh pr merge 158 --admin --squash --delete-branch` → main fast-forward `b5e4127`.

### `/compound-wrap --session` 7단계
- Step 1 git scan + active phase
- Step 2 Phase 1 3 agent 병렬 (automation-scout: 자동화 NEW 4건 / learning-extractor: MISTAKES NEW 2건 / followup-suggester: P0 1+P1 3+P2 5+P3 6) — document-specialist OMC 미가시 → 메인 inline 카논 검증
- Step 3 Phase 2 duplicate-checker (haiku) — mmp-memory vector_search 6 query → NEW 5 / DUPLICATE 1 / CROSS_REFERENCE 1
- Step 4 통합 + 사용자 표시
- Step 5 자동 실행 (handoff 노트 생성 / MEMORY entry append)
- Step 6 승인 실행 (MISTAKES NEW 1건 사용자 승인 대기 / checklist STATUS phase 디렉토리에 checklist.md 부재로 skip)
- Step 7 graphify decision: `--session` mode → skip (안내만)

## What blocked us

- 없음. PR-7 전 단계 spec 명확, 4-agent round-1 HIGH 4건은 in-PR fix로 해소, round-2 신규 HIGH 0건. admin-merge 안전.
- 메모리 카논 비위반 검증 시 duplicate-checker가 horizon Q MISTAKES를 `feedback_4agent_review_before_admin_merge.md`와 scope 중복 (DUPLICATE) 판정 — learning-extractor 2건 중 1건만 NEW로 압축.

## Next session 첫 5초

- **첫 메시지**: `/compound-resume` (한 마디).
- **메인의 첫 read 대상**: 이 파일 (`memory/sessions/2026-04-28-compound-mmp-wave3-pr7.md` — 가장 최근 mtime).
- **그 다음 read**: `~/.claude/plans/vivid-snuggling-pascal.md` § Wave 3 PR-8 spec.
- **첫 액션 후보**: CI admin-skip 만료 D-3 결정 (P0) → PR-8 진입 (P1).

| 룰 | 위치 |
|----|------|
| 4단계 라이프사이클 | `.claude/plugins/compound-mmp/refs/lifecycle-stages.md` |
| 13 anti-patterns | `refs/anti-patterns.md` |
| TDD soft ask 정책 | `refs/tdd-enforcement.md` |
| 5단계 dispatch | `refs/auto-dispatch.md` |
| 4-agent post-task-pipeline | `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json` |
| `/compound-review` 카논 | `commands/compound-review.md` + `templates/review-result-template.md` + `scripts/compound-review-dry-run.sh` |
| `/compound-resume` 카논 | `commands/compound-resume.md` + `templates/session-recall-template.md` |
| `/compound-wrap` 카논 | `commands/compound-wrap.md` + `skills/wrap-up-mmp/SKILL.md` |
| Sonnet 4.6 카논 | `memory/feedback_sonnet_46_default.md` |
| 4-agent 리뷰 강제 | `memory/feedback_4agent_review_before_admin_merge.md` |
| CI admin-skip (2026-05-01) | `memory/project_ci_admin_skip_until_2026-05-01.md` |

## 카논 이정표 (Wave 3 PR-7 종료 시점)

| 카논 | 위치 |
|------|------|
| compound-mmp plugin manifest | `.claude/plugins/compound-mmp/.claude-plugin/plugin.json` |
| compound-mmp marketplace (ctm) | `.claude/plugins/.claude-plugin/marketplace.json` |
| 활성화 entry | `.claude/settings.json` `enabledPlugins["compound-mmp@ctm"]` |
| Hook 디스패처 | `hooks/run-hook.sh` (5 events: dispatch / pre-edit-size / pre-task-model / stop-wrap-reminder / *) |
| Slash command 3종 | `commands/{compound-resume,compound-wrap,compound-review}.md` |
| Wave 1 완료 (PR-3 + PR-4) | `memory/sessions/2026-04-28-compound-mmp-wave1-complete.md` |
| Wave 2 PR-5 완료 | `memory/sessions/2026-04-28-compound-mmp-wave2-pr5.md` |
| Wave 2 PR-6 완료 | `memory/sessions/2026-04-28-compound-mmp-wave2-pr6.md` |
| Wave 3 PR-7 완료 (이 세션) | 이 파일 |
| plan 본문 | `~/.claude/plans/vivid-snuggling-pascal.md` |
