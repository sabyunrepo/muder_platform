---
topic: "compound-mmp Wave 2 PR-5 size hook + TDD soft ask 머지"
phase: "compound-mmp PR-5 (Wave 2 시작)"
prs_touched: [PR-5 #150]
session_date: 2026-04-28
---

# Session Handoff: compound-mmp Wave 2 PR-5 머지

## Decided

- **단일 PreToolUse(Edit|Write) hook이 size + TDD soft ask 통합** — 별도 hook 분리 X. `pre-edit-size-check.sh` 단일 진입점 + `run-hook.sh pre-edit-size` 디스패치 case. 향후 3rd policy 추가 시 분할 트립와이어(refs/anti-patterns에 명시할 후보).
- **CLAUDE.md 200 한도는 repo root만 적용** — `CLAUDE_PROJECT_DIR` env var 또는 `git rev-parse --show-toplevel`(file_path의 dirname 기준)로 root 식별. nested CLAUDE.md (`apps/server/CLAUDE.md` 등 자동 로딩 대상 외)는 `.md` 500 fallthrough. 카논 (`memory/feedback_file_size_limit.md`)의 "자동 로딩 토큰 비용" 근거에 충실.
- **replace_all=true 보수적 deny** — `(current + new - old)` 추정이 다중 occurrence에서 false-negative. `replace_all=true && new_lines > old_lines` 시 deny + "individual Edit calls 또는 replace_all=false" 안내. grep -cF로 정확 카운트하는 방식은 multi-line old_string 부정확 → 보수적 deny 우선.
- **jq fork 5→2~3회 압축** — 메타 추출(tool_name + file_path + replace_all)을 `@tsv`로 단일 jq 호출로 묶음. content/new_string/old_string은 multi-line 안전을 위해 분리 호출 유지 (정확도 우선). 평균 ~50ms 절감.
- **TDD soft ask 정책 카논** — N 응답 진행 허용. 4-agent test-engineer가 사후 P2 coverage 검증. PR-2c handleCombine deadlock latent 재발 방지 의도이지만 hard delete는 false sense of security → soft.
- **Wave 1 후속 카논화 5건 PR-5에 통합** — auto-dispatch.md skill-injector 직렬 카논, wrap SKILL Step 7 graphify 실패 처리, spike 표기 5→4 정정, stop-wrap-reminder ENV var, compound-wrap.md thin pointer. 별도 PR로 분리 안 함 (응집성 유지).
- **4-agent + critic 재re-review 패턴 적용** — security/code-perf/critic/test-engineer 4명 한 메시지에서 spawn → P0 0건 + P1 4건 fix → critic 단독 재re-review APPROVE. 핸드오프 카논 `feedback_4agent_review_before_admin_merge.md` 충족.

## Rejected

- ~~replace_all=true의 occurrence를 grep -cF로 정확 카운트 후 곱셈~~ → multi-line old_string 부정확 + 복잡도 증가. 보수적 deny가 단순·안전. 사용자가 진짜 필요하면 명시적 multiple Edit calls.
- ~~CLAUDE.md basename 매치를 모든 위치에 200 적용~~ → 카논과 충돌. nested CLAUDE.md는 자동 로딩 대상 외이므로 .md 500.
- ~~enabledPlugins 등록을 PR-5에 포함~~ → PR-1 scaffold scope. 별도 hotfix PR로 분리.
- ~~bats 의존성 추가~~ → plain bash test runner (dispatch와 동일 패턴). CI 환경 의존성 최소화.
- ~~jq 단일 호출 + base64 인코딩~~ → 추가 fork 부담 + 복잡도. content류는 분리 호출이 가독성 우월.
- ~~MISTAKES.md append~~ → 사용자 명시 승인 발화 없음. 다음 세션에서 결정.

## Risks

- **enabledPlugins 미등록** (critic Q9, PR-5 scope 외) — repo `.claude/settings.json`은 `harness@harness-marketplace`만 등록. `compound-mmp@local` 부재로 plugin hook이 실 사용자 세션에서 발화 X. CI는 직접 bash 호출이라 영향 없음. 별도 hotfix PR (`chore/compound-mmp-enable`) 필수. 우선순위 P0 — Wave 2 dogfooding 시작 전.
- **Skill auto-activation + hook 중복 prompt** (critic P2 #5) — `tdd-mmp-go/SKILL.md`/`tdd-mmp-react/SKILL.md`가 description 기반 자동 활성화될 때 hook ask와 함께 노출되면 double prompting 가능. 카논상 hook이 master임을 명시했으나 실측 미수행. PR-10 dogfooding 1주 후 calibration.
- **TDD ask UX cliff at scale** (critic P2 #4) — 10 파일 PR 시 10 ask 인터럽트. `COMPOUND_MMP_SIZE_HOOK_DISABLE=1`은 size까지 모두 비활성 (too coarse). 분리 disable 또는 session ack sentinel은 dogfooding 결과 기반 결정.
- **CI matrix asymmetry** (critic Q6) — Ubuntu는 `bash` (5.x), macOS는 `/bin/bash` (3.2). dev가 macOS Homebrew bash 5.x 사용 시 CI 동작 불일치 가능. 추가 macOS step (PATH 기본 bash) 검토.
- **graphify-out 미커밋** — branch 분기 시점부터 graphify-out/{GRAPH_REPORT.md, graph.json} 변경 분이 있었으나 PR-5 diff에서 제외 (정책 D 일상 commit 금지). 다음 wrap 또는 Phase 종료 시 fresh rebuild PR.
- **Phase 19 Residual W4 미착수** — PR-9 WS Auth / PR-10 Runtime Payload Validation, L+L 규모. compound-mmp Wave 2 hook 활성화 시 작업자에게 PreToolUse ask 노출. PR-9/10 시작 시 dogfooding 모니터링.

## Files

### 신규 (main에 통합 완료, PR #150)
- `.claude/plugins/compound-mmp/hooks/pre-edit-size-check.sh` (182줄, +x)
- `.claude/plugins/compound-mmp/hooks/test-pre-edit-size.sh` (299줄, +x, 38 fixture cases)
- `.claude/plugins/compound-mmp/skills/tdd-mmp-go/SKILL.md`
- `.claude/plugins/compound-mmp/skills/tdd-mmp-react/SKILL.md`
- `.github/workflows/ci-hooks.yml` (shellcheck + dispatch + size-tdd matrix)

### 수정 (main)
- `.claude/plugins/compound-mmp/hooks/hooks.json` (PreToolUse(Edit|Write) 등록)
- `.claude/plugins/compound-mmp/hooks/stop-wrap-reminder.sh` (COMPOUND_WRAP_MIN_LINES + DISABLE ENV)
- `.claude/plugins/compound-mmp/refs/auto-dispatch.md` (skill-injector 직렬 카논)
- `.claude/plugins/compound-mmp/refs/spike-omc-overlap.md` (5→4 정정)
- `.claude/plugins/compound-mmp/skills/wrap-up-mmp/SKILL.md` (Step 7 실패 처리)
- `.claude/plugins/compound-mmp/commands/compound-wrap.md` (thin pointer)

### 미작성 (Wave 2 이후)
- `memory/MISTAKES.md` (다음 wrap Step 6 첫 사용 시)
- `memory/QUESTIONS.md` (PR-5 enabledPlugins follow-up 추가 후보)

## Remaining

### Wave 2 PR-6 (model guard 단독 — SessionStart hook 폐기)
- **Done**: `pre-task-model-guard.sh` (Sonnet 4.5 차단), hooks.json PreToolUse(Task) 등록, bats 테스트 fixture, CI matrix 동일.
- **Note**: 사용자 결정 2026-04-28 — `session-start-context.sh` 자동 inject 폐기. 대신 `/compound-resume` 슬래시 커맨드가 PR `chore/compound-mmp/resume-slash-only` (#152)에서 별도 머지됨. PR-6 scope에서 SessionStart inject 작업 모두 제거.

### 즉시 hotfix
- **enabledPlugins 등록** (`chore/compound-mmp-enable`): repo `.claude/settings.json`에 `compound-mmp@local: true` 추가 + 검증. PR-5 hook이 실 발화하는지 dogfooding 1회.

### 후속 PR (Wave 3/4 — 카논 유지)
- PR-7: `/compound-review` + post-task-pipeline 4-agent 브릿지 + P0–P3 라우팅
- PR-8: `/compound-plan` + qmd-recall 스킬 (`mmp-plans` vector_search)
- PR-9: `/compound-work` + worktree + TDD 가드 + 2-stage subagent review
- PR-10: `/compound-cycle` + 시뮬레이션 검증 (Case A/B/C) + 1주 dogfooding

## Next Session Priorities

1. **enabledPlugins hotfix 우선** — 1줄 변경, dogfooding 가능 환경 확보. PR-5의 hook이 실 발화하는지 검증 후 Wave 2 진행.
2. **Wave 2 PR-6 진입** — `pre-task-model-guard.sh` 단독 (Sonnet 4.5 차단). 동일 단일 hook + run-hook 디스패치 패턴. SessionStart hook 작업 폐기 — `/compound-resume` 슬래시 커맨드가 #152에서 이미 카논화됨.
3. **dogfooding 시작** — 다음 PR 작업 시 size hook 차단 1회 + TDD ask 1회 실 사용 후 임계값/예외 calibration.
4. **다음 세션 진입 패턴**: 사용자가 `/compound-resume` 명시 호출 → 메인이 가장 최근 핸드오프 + plan + 카논 cheat-sheet read. 자동 SessionStart inject은 폐기 (낭비 회피, 사용자 결정 2026-04-28). 카논: `commands/compound-resume.md`, `templates/session-recall-template.md`.

## What we did

PR-5 단일 PR로 Wave 2 진입 코어를 구축. PreToolUse(Edit|Write) hook이 size + TDD soft ask를 통합 처리. bash 3.2(macOS) / 5.x(Linux) 모두 38/38 + 41/41 fixture PASS. CI matrix 게이트 추가.

4-agent 병렬 리뷰(security/code-perf/critic/test-engineer) 한 메시지 spawn → P0 0건 + P1 4건(CLAUDE.md scope, replace_all 우회, jq fork latency, missing fixture) fix → critic 재re-review APPROVE. PR-2c #107 사고 이후 카논화된 패턴 정확히 충족.

Wave 1 핸드오프 노트의 6 Risks 중 5건 카논화로 해소(skill-injector 직렬, graphify 실패 처리, spike 표기, ENV var, command thin pointer). 잔여 1건(enabledPlugins 미등록)은 PR-1 scope이므로 별도 hotfix로 분리.

핵심 카논 추가/명시: hook이 SKILL의 master, replace_all 보수적 deny, root vs nested CLAUDE.md 분기.

## What blocked us

- 첫 jq @tsv 압축 시도가 multi-line content를 escape시켜 라인 카운트 깨짐 → Edit 분기 new_string/old_string은 분리 호출로 회귀. 메타(tool_name+file_path+replace_all)만 @tsv 묶음.
- test runner의 `[ "$VERBOSE" = "verbose" ] && echo` 단축 평가가 set -e 환경에서 false 시 함수 조기 종료 → if-fi 형태로 교체 (dispatch test runner와 동일 패턴).
- cleanup trap의 `&& rm -rf` 단축 평가 false → if-block + return 0으로 명시적 보호.

## Next session 첫 5초

- **가장 먼저 read**: 이 핸드오프 노트 + `.claude/plugins/compound-mmp/refs/lifecycle-stages.md` (4단계 게이트) + `refs/wrap-up-checklist.md`.
- **enabledPlugins hotfix가 P0** — Wave 2 PR-6 진입 전 처리.
- **TaskList**: 모두 closed (PR-5 13/13 완료). 다음 세션 새 task list.
- **bash 3.2 호환 검증 새 hook 작성 시 필수** — `${var,,}` / mapfile / readarray / declare -gA 금지. CI macOS step에서 잡힘.
