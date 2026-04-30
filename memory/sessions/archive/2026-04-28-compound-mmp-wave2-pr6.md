---
topic: "compound-mmp Wave 2 완료 — PR-6 PreToolUse(Task) Sonnet 4.5 차단 hook"
phase: "Wave 2 완료 (PR-5 size hook + PR-6 model-guard) → Wave 3 (PR-7 /compound-review + PR-8 /compound-plan) 대기"
prs_touched: [PR-#156]
session_date: 2026-04-28
---

# Session Handoff: Wave 2 PR-6 PreToolUse(Task) Sonnet 4.5 차단 hook 완료

## Decided

- **PR #156 머지 (`9e9b221`)** — `pre-task-model-guard.sh` PreToolUse(Task) hook + 25 케이스 fixture + ubuntu/macOS bash 3.2/5.x CI matrix. PATTERN `(claude-)?sonnet-4[-.]5` case-insensitive. tool_input.prompt + .model 양쪽 검사. 4.6 / haiku-4-5 / opus-4-7 카논 안내 메시지.
- **인라인 perf 최적화** — 4-agent perf review LOW 권고에 따라 jq fork 2→1 압축 (자매 `pre-edit-size-check.sh` 패턴 정확 대칭). `silent path` 1 fork, `deny path` 2 fork. 25/25 retain.
- **4-agent 리뷰 결과 HIGH 0건** — Security Pass / Architecture Pass with caveats / Test Pass / Perf Pass with caveats. admin-merge 안전 진행 (memory/feedback_4agent_review_before_admin_merge.md 카논 준수).
- **`/compound-resume` 첫 dogfooding 정상** — 명시 호출 → handoff + plan + 카논 cheat-sheet 일괄 read 검증. 자동 SessionStart inject 폐기 결정 (2026-04-28) 검증됨.
- **`pre-task-model-guard.sh` 자체 dogfooding 정상** — 이 세션에서 4-agent + duplicate-checker + 3 wrap agent 총 7회 Task spawn. 모두 prompt에 4.5 미언급으로 silent 통과. hook latency 영향 무관.
- **Wave 2 완료** — Wave 3 진입 spec 확정 (PR-7 `/compound-review` + post-task-pipeline 4-agent 브릿지 + P0–P3 라우팅 / PR-8 `/compound-plan` + qmd-recall 스킬).

## Rejected

- ~~MED-1 PATTERN 단어 경계 강화 즉시 hotfix~~ → carry-over로 처리 (learning-extractor: 회귀 위험 LOW, 가상 ID `sonnet-4-50` 명명 규칙 미존재. followup-suggester P0 분류는 잘못된 추론 — pre-task-model-guard.sh와 PR-7 post-task-pipeline은 다른 영역)
- ~~LOW carry-over 4건 동시 fix~~ → 자연스러운 유지보수 시점 또는 PR-10 dogfooding scope. carry-over 누적 5건은 다음 wrap 또는 hotfix.
- ~~`/compound-work` 명령 사용~~ → 미구현 (PR-9 예정), PR-6 자체는 수동 워크플로우로 진행

## Risks

- **Wave 3 진입 시 carry-over 누적 가시성** — 5 LOW + 1 MED + 2 phantom-suspect (`Q-shopt`) = 8건. 다음 세션에서 한 번에 보일 위험. wrap handoff·QUESTIONS·MEMORY 분산 등재로 산만함.
- **CI admin-skip 정책 만료 (2026-05-01)** — 3일 남음. 만료 후 PR-7+8은 정식 CI green 필요. 이 시점에 미해소 carry-over는 CI red 가능성 있는 항목 우선 처리.
- **graphify-out 미커밋** — 정책 D (일상 commit 금지) 유지. wrap에서 명시적 무시 카논.

## Files

### 이번 세션 main 변경 (PR #156, `9e9b221`)
- NEW: `.claude/plugins/compound-mmp/hooks/pre-task-model-guard.sh` (75줄)
- NEW: `.claude/plugins/compound-mmp/hooks/test-pre-task-model.sh` (175줄, 25 케이스)
- MOD: `.claude/plugins/compound-mmp/hooks/hooks.json` (PreToolUse Task matcher entry 추가)
- MOD: `.github/workflows/ci-hooks.yml` (ubuntu + macOS step 2개 추가)

### 이번 wrap에서 main 변경 (별도 commit)
- NEW: `memory/QUESTIONS.md` (Q-regex / Q-shopt / Q-sim-c 3건)
- NEW: `memory/sessions/2026-04-28-compound-mmp-wave2-pr6.md` (이 파일)
- MOD: `memory/MEMORY.md` (Wave 2 PR-6 항목 + ctm marketplace pointer 추가)

### 미생성 (다음 wrap 또는 PR에서)
- `memory/MISTAKES.md` (이번 세션 NEW 0건 — 4-agent 리뷰 프로세스가 강제점으로 작동)
- `.claude/plugins/compound-mmp/refs/sim-case-c.md` (PR-10 dogfooding scope)

## Remaining

### Wave 3 진입 spec (즉시 — 다음 세션 main 작업 후보)
- **PR-7** `/compound-review` + post-task-pipeline 4-agent 브릿지 + P0–P3 라우팅 (Done: `/compound-review` 호출 시 4-agent spawn → `docs/plans/<phase>/refs/reviews/<pr-id>.md` 생성, HIGH 발견 시 사용자 결정 대기)
- **PR-8** `/compound-plan` + `qmd-recall` 스킬 (Done: `/compound-plan <topic>` 호출 시 brainstorming + writing-plans + QMD vector_search 회상 통합 → `docs/plans/<date>-<topic>/checklist.md` 초안)

### Carry-over backlog (이번 PR 4-agent 리뷰에서 식별)
- **MED-1** PATTERN 단어 경계 강화 (`(claude-)?sonnet-4[-.]5` → 단어경계 가산). 회귀 테스트 포함. Effort S, Impact Low (회귀 위험 LOW 평가). PR-10 또는 별도 hotfix.
- **LOW-1** `trap 'shopt -u nocasematch' EXIT` 안전 패턴 (현재 subshell fresh 호출이라 실해 0). PR-7 piggyback 또는 PR-10.
- **LOW-2** 파일명 어휘 통일 (`pre-task-model-check.sh` 또는 `pre-edit-size-guard.sh`). PR-10 시점 일괄 rename.
- **LOW-3** shellcheck SC2086 광범위 비활성 → per-line `# shellcheck disable=SC2086` 좁히기. PR-9 또는 wrap.
- **TEST-LOW 5건** — bare `model='sonnet-4-5'`, multiline prompt, "Claude Sonnet 4 dot 5" 공백 silent 문서화, model null/"" robustness. PR-10 dogfooding scope.

### Carry-over 이전 세션 미해소
- **Q-shopt** `dispatch-router.sh shopt -u nocasematch` 복원 phantom 검증 — Wave 3 진입 전 `test-dispatch.sh` 1회 실행으로 실재/phantom 결정 (Effort: 5분).
- **memory/MEMORY.md `ctm` marketplace 인덱스** — 이번 wrap Step 5-3에서 처리 완료 (즉시 처리 대상이었음).

### Wave 3 진입 결정 (사용자 검토 필요)
- carry-over hotfix를 Wave 3 진입 전 묶을지 (followup-suggester P0 권고) vs PR-7/PR-8에 piggyback (learning-extractor 권고)
- 권고: **piggyback** — followup-suggester의 "post-task-pipeline 영향" 추론은 잘못. pre-task-model-guard.sh는 PreToolUse hook으로 PR-7 post-task-pipeline와 영역 다름.

## Next Session Priorities

1. **Q-shopt phantom 검증** — `bash .claude/plugins/compound-mmp/hooks/test-dispatch.sh` 1회 (5분). 실재면 `trap RETURN` 보강 hotfix, phantom이면 carry-over 폐기.
2. **PR-7 진입** — `/compound-review` + post-task-pipeline 4-agent 브릿지. branch `feat/compound-mmp/PR-7-review-bridge`. 사전 정비: `.claude/post-task-pipeline.json` repo root canonical 확인.
3. **CI admin-skip 만료 임박** (2026-05-01, 3일) — PR-7 진행 중 정식 CI green 필요할 가능성. shellcheck/test-pre-task-model 등 신규 step이 main에서 첫 실행되는 시점 모니터링.
4. **Wave 3 결과 누적 후 carry-over hotfix 묶음 PR** — PR-7 + PR-8 머지 후 5 LOW + 1 MED를 하나의 hygiene PR로 정리 (Effort 1h 예상).

## What we did

### `/compound-resume` 첫 dogfooding
사용자가 세션 첫 발화로 `/compound-resume` 명시 호출. command.md (`commands/compound-resume.md`) 정의대로 가장 최근 mtime의 `memory/sessions/2026-04-28-compound-mmp-enable-hotfix.md` + plan `~/.claude/plans/vivid-snuggling-pascal.md` Wave 2 PR-6 spec + 카논 cheat-sheet 일괄 read. 출력은 `templates/session-recall-template.md` ≤30 lines 형식 준수. SessionStart 자동 inject 폐기 결정 (2026-04-28) 검증.

### PR-6 TDD 사이클
1. branch `feat/compound-mmp/PR-6-task-model-guard` (origin/main 기준)
2. Red: `test-pre-task-model.sh` 25 케이스 (tool_name 게이트 / JSON 비정상 / prompt deny 변형 6 / model 매칭 2 / false positive 회피 6 (haiku-4-5, sonnet-4-6, opus-4-7, "version 4.5 of postgres", plain "sonnet", null/"") / env disable / reason 형식). hook 부재 상태에서 9 deny 케이스 fail 확인.
3. Green: `pre-task-model-guard.sh` 75줄 — `set -eu`, jq guard, `COMPOUND_MMP_MODEL_GUARD_DISABLE=1` 토글, tool_name=Task 게이트, prompt+model 동시 jq 추출 (@tsv), `nocasematch` shopt + 정규식 `(claude-)?sonnet-4[-.]5`, deny + 4.6/haiku/opus 안내. 25/25 pass on bash 5.3.9 + bash 3.2.57 양쪽.
4. hooks.json PreToolUse Task matcher entry 추가, ci-hooks.yml ubuntu + macOS 양쪽에 step 추가.
5. Commit `6d6e12b` + push.

### 4-agent 병렬 리뷰
single message에 4 agents spawn (memory/feedback_4agent_review_before_admin_merge.md 카논). Security/Arch는 opus-4-7, Test/Perf는 sonnet-4-6 모델 위임. 결과: HIGH 0건. Perf LOW (jq fork 2→1) 인라인 적용 후 commit `f3e2710` push. 25/25 retain.

### admin-merge
`gh pr merge 156 --admin --squash --delete-branch` → main fast-forward `9e9b221`. CI admin-skip 정책 (project_ci_admin_skip_until_2026-05-01.md) 활성 기간.

### `/compound-wrap --wave` 7단계
- Step 1 git scan + active phase metadata
- Step 2 Phase 1 3 agent 병렬 (automation-scout / learning-extractor / followup-suggester) — document-specialist는 OMC plugin 미가시 → 메인 컨텍스트가 카논 검증 inline
- Step 3 Phase 2 duplicate-checker (haiku-4-5) — QMD `mmp-memory` vector_search 8회 → NEW 7건, dup 1건
- Step 4 통합 + 사용자 표시
- Step 5 자동 실행 (QUESTIONS append 3건 / handoff 노트 생성 / MEMORY entry append)
- Step 6 승인 실행 (MISTAKES NEW 0건 → skip / checklist STATUS는 user-home plan, 사용자 결정 대기)
- Step 7 graphify decision: `--wave` mode → `make graphify-update` 안내 출력만, 자동 rebuild X (anti-patterns #4)

## What blocked us

- 없음. PR-6 spec 명확, 4-agent HIGH 0건, dogfooding 첫 신호 모두 정상.
- 메모리 카논 비위반 검증 시 followup-suggester가 MED-1을 "Wave 3 진입 차단 P0"로 잘못 분류 — pre-task-model-guard.sh와 PR-7 post-task-pipeline은 별개 영역이라는 지적이 learning-extractor에서 phantom 의심으로 교차 확인. 메인 컨텍스트가 최종 carry-over로 분류 결정.

## Next session 첫 5초

- **첫 메시지**: `/compound-resume` (한 마디).
- **메인의 첫 read 대상**: 이 파일 (`memory/sessions/2026-04-28-compound-mmp-wave2-pr6.md` — 가장 최근 mtime).
- **그 다음 read**: `~/.claude/plans/vivid-snuggling-pascal.md` § Wave 3 PR-7 spec.
- **첫 액션 후보**: `bash .claude/plugins/compound-mmp/hooks/test-dispatch.sh` (Q-shopt phantom 검증, 5분).

| 룰 | 위치 |
|----|------|
| 4단계 라이프사이클 | `.claude/plugins/compound-mmp/refs/lifecycle-stages.md` |
| 13 anti-patterns (#13 SessionStart inject 폐기) | `refs/anti-patterns.md` |
| TDD soft ask 정책 | `refs/tdd-enforcement.md` |
| 5단계 dispatch | `refs/auto-dispatch.md` |
| 4-agent post-task-pipeline | `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json` |
| `/compound-resume` 카논 | `commands/compound-resume.md` + `templates/session-recall-template.md` |
| `/compound-wrap` 카논 | `commands/compound-wrap.md` + `skills/wrap-up-mmp/SKILL.md` |
| Sonnet 4.6 카논 | `memory/feedback_sonnet_46_default.md` |
| 4-agent 리뷰 강제 | `memory/feedback_4agent_review_before_admin_merge.md` |
| CI admin-skip (2026-05-01) | `memory/project_ci_admin_skip_until_2026-05-01.md` |

## 카논 이정표 (Wave 2 종료 시점)

| 카논 | 위치 |
|------|------|
| compound-mmp plugin manifest | `.claude/plugins/compound-mmp/.claude-plugin/plugin.json` |
| compound-mmp marketplace (ctm) | `.claude/plugins/.claude-plugin/marketplace.json` |
| 활성화 entry | `.claude/settings.json` `enabledPlugins["compound-mmp@ctm"]` |
| Hook 디스패처 | `hooks/run-hook.sh` (5 events: dispatch / pre-edit-size / pre-task-model / stop-wrap-reminder / *) |
| Wave 1 완료 (PR-3 + PR-4) | `memory/sessions/2026-04-28-compound-mmp-wave1-complete.md` |
| Wave 2 PR-5 완료 | `memory/sessions/2026-04-28-compound-mmp-wave2-pr5.md` |
| Wave 2 PR-6 완료 (이 세션) | 이 파일 |
| plan 본문 | `~/.claude/plans/vivid-snuggling-pascal.md` |
