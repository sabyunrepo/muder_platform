---
topic: "compound-mmp Wave 2 진입 점 — PR-5 + resume-slash 통합 후"
phase: "Wave 2 (PR-5 머지 + chore resume-slash 카논화)"
prs_touched: [PR-5 #150, handoff #151, chore #152]
session_date: 2026-04-28
---

# Session Handoff: compound-mmp Wave 2 진입 점 (resume-slash 카논화 후)

## Decided

- **`/compound-resume` 슬래시 커맨드만 유지** — SessionStart hook 자동 inject 폐기 (사용자 결정 2026-04-28). 매 세션 ~1-2K 토큰 자동 inject가 단순 PR/한가한 세션에서 낭비. 명시 호출 패턴이 효율적. anti-patterns #13 carve-out으로 카논화 (carve-out 없음, fully 폐기).
- **PR-5 통합 머지** — size hook + TDD soft ask + Wave 1 후속 카논화 5건. 4-agent 리뷰 + critic 재re-review APPROVED. 38/38 + 41/41 fixture pass (bash 3.2 + 5.x).
- **PR-6 scope 축소** — `pre-task-model-guard.sh` 단독. SessionStart 작업 모두 제거. 단일 hook + run-hook 디스패치 패턴 유지.
- **`run-hook.sh` event 4개 카논** — `dispatch / pre-edit-size / pre-task-model / stop-wrap-reminder`. session-start case 영구 제거.
- **TeamCreate 도입 보류** — Phase 단위 통합 검증(Wave 4 PR-9/10 + sim Case A/B/C 동시) 시점에만 검토. PR 단위는 현 핸드오프 inject 카논 유지가 효율적이라는 사용자 확인.

## Rejected

- ~~SessionStart hook + 슬래시 커맨드 1+2 조합~~ → 슬래시 단독 (낭비 회피, 사용자 결정)
- ~~`hooks/session-start-context.sh` 신설~~ → 신설 금지 (anti-patterns #13)
- ~~`templates/session-recall-template.md`을 SessionStart 출력 형식 카논으로 유지~~ → slash command 출력 형식으로 재정의
- ~~기존 핸드오프 파일에 모든 후속 결정 append~~ → 새 핸드오프 파일 분리 (한 세션 한 파일 카논 기본 유지, PR 단위 분리)

## Risks

- **enabledPlugins 미등록** (Wave 1부터 carry-over, P0) — repo `.claude/settings.json`에 `compound-mmp@local: true` 미추가. plugin hook이 실 사용자 세션에서 발화 X. 별도 hotfix PR(`chore/compound-mmp-enable`)이 Wave 2 dogfooding 시작 전 필수.
- **`/compound-resume` 동작 검증 미수행** — 카논 정의만 머지. 다음 세션에서 사용자가 `/compound-resume` 호출 시 메인이 description대로 read 수행하는지 실측 필요. 실패 시 description 보강(예: 명시적 read 단계 나열).
- **TDD ask UX cliff** (PR-5 critic P2 #4 carry-over) — 10 파일 PR 시 10 ask 인터럽트. dogfooding 결과 기반으로 `COMPOUND_MMP_TDD_ASK_DISABLE` 분리 또는 session ack sentinel 검토.
- **Skill auto-activation + hook 중복 prompt** (PR-5 critic P2 #5 carry-over) — `tdd-mmp-go/SKILL.md`/`tdd-mmp-react/SKILL.md`가 description 기반 자동 활성화될 때 hook ask와 함께 노출되면 double prompting 가능. PR-10 dogfooding 1주 후 calibration.
- **Phase 19 Residual W4 미착수** — PR-9 WS Auth / PR-10 Runtime Payload Validation, L+L 규모. compound-mmp Wave 2 hook 활성화 시 작업자에게 PreToolUse ask 노출.
- **graphify-out 미커밋** — branch 전환 마다 working tree dirty 표시. 정책 D 일상 commit 금지 유지.

## Files

### 이번 세션 main 변경 (3 PR 통합)

#### PR #150 (feat — PR-5)
- NEW: `hooks/pre-edit-size-check.sh` (182줄, +x)
- NEW: `hooks/test-pre-edit-size.sh` (299줄, +x, 38 cases)
- NEW: `skills/tdd-mmp-go/SKILL.md`
- NEW: `skills/tdd-mmp-react/SKILL.md`
- NEW: `.github/workflows/ci-hooks.yml`
- MOD: `hooks/hooks.json` (PreToolUse 등록)
- MOD: `hooks/stop-wrap-reminder.sh` (ENV var)
- MOD: `refs/auto-dispatch.md` (skill-injector 직렬 카논)
- MOD: `refs/spike-omc-overlap.md` (5→4 정정)
- MOD: `skills/wrap-up-mmp/SKILL.md` (Step 7 graphify 실패 처리)
- MOD: `commands/compound-wrap.md` (thin pointer)

#### PR #151 (docs — handoff)
- NEW: `memory/sessions/2026-04-28-compound-mmp-wave2-pr5.md`

#### PR #152 (chore — resume-slash 카논화)
- NEW: `commands/compound-resume.md`
- MOD: `templates/session-recall-template.md` (slash output 형식)
- MOD: `refs/lifecycle-stages.md`, `refs/wrap-up-checklist.md`, `refs/anti-patterns.md` (#13 추가)
- MOD: `skills/wrap-up-mmp/SKILL.md` (종료 후 + 검증)
- MOD: `agents/followup-suggester.md` (Why_This_Matters)
- MOD: `hooks/run-hook.sh` (session-start case 제거)
- MOD: `memory/sessions/2026-04-28-compound-mmp-wave2-pr5.md` (PR-6 spec 정정)

### user home (repo 외)
- MOD: `~/.claude/plans/vivid-snuggling-pascal.md` — 6곳 sync (디렉토리 layout / hook 표 / 핸드오프 형식 / Wave 2 PR-5 spec / Wave 4 PR-10 spec / Appendix C PR-6 spec)

### 미작성 (Wave 2 이후 — 변경 없음)
- `memory/MISTAKES.md`, `memory/QUESTIONS.md` (다음 wrap에서 첫 사용)

## Remaining

### 즉시 hotfix (P0)
- **`chore/compound-mmp-enable`** — repo `.claude/settings.json`의 `enabledPlugins`에 `compound-mmp@local: true` 1줄 추가. PR-5 hook이 실 사용자 세션에서 발화하도록.

### Wave 2 PR-6 (축소 scope)
- **`pre-task-model-guard.sh`** — Sonnet 4.5 차단 + 4.6 안내. PreToolUse(Task) hook 등록.
- bats 테스트 fixture (model-guard) + CI matrix.
- SessionStart 작업 폐기 — 이미 #152에서 카논화.

### 후속 PR (Wave 3/4 — 기존 카논)
- PR-7: `/compound-review` + post-task-pipeline 4-agent 브릿지 + P0–P3 라우팅
- PR-8: `/compound-plan` + qmd-recall 스킬
- PR-9: `/compound-work` + worktree + TDD 가드 + 2-stage subagent review
- PR-10: `/compound-cycle` + 시뮬레이션 검증 (Case A/B/C) + 1주 dogfooding

## Next Session Priorities

1. **`/compound-resume` 호출** — 다음 세션 첫 메시지로 명시 호출. 메인이 이 핸드오프 + plan + 카논 cheat-sheet read 후 5초 안에 작업 진입 점 확보.
2. **enabledPlugins hotfix** (P0, ~5분) — Wave 2 dogfooding 시작 전 필수.
3. **Wave 2 PR-6 진입** — `pre-task-model-guard.sh` 단독. branch `feat/compound-mmp/PR-6-task-model-guard` (main 직접 분기).
4. **dogfooding 시작** — PR-6 작업 중 size hook 차단 + TDD ask + model guard 차단을 자연스럽게 실 사용 1회 이상.

## What we did

세션 1개 안에서 3 PR 통합 머지: PR-5 (size hook + TDD soft ask + Wave 1 후속 카논화), #151 (PR-5 wrap 핸드오프), #152 (SessionStart 자동 inject 폐기 + `/compound-resume` 카논화). 사용자 토큰 효율 결정에 따라 1+2 조합을 2 단독으로 정정하고 anti-patterns #13으로 영구화.

PR-5는 4-agent 병렬 리뷰 + critic 재re-review 패턴 적용, P0 0건 + P1 4건 fix(CLAUDE.md scope, replace_all 우회, jq fork latency, missing fixture). hook은 bash 3.2(macOS) / 5.x(Linux) 모두 38/38 fixture PASS.

`/compound-resume` 슬래시 커맨드는 hook 없이 메인 컨텍스트가 description 따라 read 수행 — 별도 script 의존성 0. 다음 세션 첫 메시지 한 마디로 작업 재개.

## What blocked us

- 첫 jq @tsv 압축이 multi-line content escape로 라인 카운트 깨짐 → Edit 분기 분리 호출 회귀.
- test runner의 `[ ] && echo` 단축 평가가 set -e 환경에서 false 시 함수 조기 종료 → if-fi 패턴(dispatch와 동일)으로 교체.
- cleanup trap의 `&& rm -rf` 단축 평가 false → if-block + return 0.

## Next session 첫 5초

- **첫 메시지**: `/compound-resume` (한 마디).
- **메인의 첫 read 대상**: 이 파일 (`memory/sessions/2026-04-28-compound-mmp-resume-slash.md` — 가장 최근 mtime).
- **그 다음 read**: `~/.claude/plans/vivid-snuggling-pascal.md` (Wave 2 PR-6 spec 정정 반영됨).
- **카논 cheat-sheet** (사용자 발화 기반 추가 read):

| 룰 | 위치 |
|----|------|
| 4단계 라이프사이클 | `refs/lifecycle-stages.md` |
| 7단계 wrap 시퀀스 | `refs/wrap-up-checklist.md` + `skills/wrap-up-mmp/SKILL.md` |
| 13 anti-patterns | `refs/anti-patterns.md` (#13 SessionStart inject 폐기 신규) |
| TDD soft ask 정책 | `refs/tdd-enforcement.md` |
| 5단계 dispatch 분류 | `refs/auto-dispatch.md` (skill-injector 직렬 카논 포함) |
| 4-agent post-task-pipeline | `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json` |
| `/compound-resume` | `commands/compound-resume.md` + `templates/session-recall-template.md` |

- **미해결 사용자 결정**: 없음. enabledPlugins hotfix는 P0이지만 결정 사안 X (단순 1줄 추가).
- **bash 3.2 호환 검증 새 hook 작성 시 필수** — `${var,,}` / mapfile / readarray / declare -gA 금지. CI macOS step에서 잡힘.
