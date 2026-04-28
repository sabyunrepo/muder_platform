# compound-mmp 플러그인 (4단계 라이프사이클)

MMP v3 전용 Claude Code 플러그인. Compound Engineering Plan-Work-Review-Compound 4단계 순환 + Session-Wrap 자동 분석 + Superpowers TDD soft ask 통합.

## 활성화 메타데이터

- **Plugin 위치**: `.claude/plugins/compound-mmp/`
- **Marketplace**: `ctm` (directory source) — `.claude/plugins/.claude-plugin/marketplace.json` (PR #154, `8190ce7`)
- **Enabled entry**: `.claude/settings.json` `enabledPlugins["compound-mmp@ctm"]`
- **Plugin manifest**: `.claude/plugins/compound-mmp/.claude-plugin/plugin.json`

## 4단계 라이프사이클

| 단계 | 명령 | 산출 |
|------|------|------|
| Plan | `/compound-plan <topic>` (PR-8 예정) | `docs/plans/<date>-<topic>/checklist.md` 초안 |
| Work | `/compound-work [pr-id]` (PR-9 예정) | feature 브랜치 + worktree + TDD soft ask 활성 |
| Review | `/compound-review [pr-id]` (PR-7 예정) | post-task-pipeline 4-agent 병렬 결과 (`docs/plans/<phase>/refs/reviews/<pr-id>.md`) |
| Compound | `/compound-wrap [--session\|--wave\|--phase]` (활성) | MEMORY entry append + sessions handoff + MISTAKES/QUESTIONS append |

추가 명령:
- `/compound-resume` (활성) — 가장 최근 핸드오프 + plan + 카논 cheat-sheet 일괄 read (자동 SessionStart inject 폐기, 2026-04-28)
- `/compound-cycle` (PR-10 예정) — 4단계 진행 상태 dry-run 대시보드

## Hook 인프라 (활성)

| Hook | Matcher | 동작 | 차단 |
|------|---------|------|------|
| PreToolUse | `Edit\|Write` | `pre-edit-size-check.sh` — Go 500/TS·TSX 400/MD 500/CLAUDE.md 200 한도 + TDD soft ask | deny / ask |
| PreToolUse | `Task` | `pre-task-model-guard.sh` — Sonnet 4.5 차단 + 4.6 안내 (PR-6 #156) | deny |
| Stop | `*` | `stop-wrap-reminder.sh` — 변경 50줄+ 미실행 시 한 줄 리마인드 | 비차단 |
| UserPromptSubmit | `*` | `dispatch-router.sh` — 인텐트 자동 분류 (plan/work/review/wrap/cycle) | 비차단 |

긴급 우회 토글:
- `COMPOUND_MMP_SIZE_HOOK_DISABLE=1` (size hook)
- `COMPOUND_MMP_MODEL_GUARD_DISABLE=1` (model guard)

## 4-agent 통합 (post-task-pipeline)

`/compound-review`는 OMC `oh-my-claudecode:security-reviewer/code-reviewer/architect/test-engineer` 4 agent를 병렬 호출. 자체 reviewer 정의 0개 (충돌 회피).

`/compound-wrap`는 `compound-mmp:automation-scout/learning-extractor/followup-suggester/duplicate-checker` 4 agent (PR-2 #145).

## Wave 진행 상황

| Wave | PR | Status |
|------|------|--------|
| Wave 1 | PR-3 (`/compound-wrap` + wrap agents) + PR-4 (dispatch-router) | 완료 (#148, #150 hotfix) |
| Wave 2 | PR-5 (size hook + TDD soft ask) + PR-6 (model-guard) | 완료 (#150, #156, 2026-04-28) |
| Wave 3 | PR-7 (`/compound-review`) + PR-8 (`/compound-plan` + qmd-recall) | 대기 |
| Wave 4 | PR-9 (`/compound-work` + worktree) + PR-10 (`/compound-cycle` + dogfooding sim) | 미착수 |

## 핸드오프 sequence (sessions/ 디렉토리)

```
memory/sessions/
├── 2026-04-28-compound-mmp-wave1-complete.md       # Wave 1 완료 (PR-3+PR-4)
├── 2026-04-28-compound-mmp-resume-slash.md         # /compound-resume 카논화 (#152)
├── 2026-04-28-compound-mmp-wave2-pr5.md            # PR-5 size hook 완료
├── 2026-04-28-compound-mmp-enable-hotfix.md        # ctm marketplace 등록 (#154)
└── 2026-04-28-compound-mmp-wave2-pr6.md            # Wave 2 완료, model-guard (#156)
```

다음 세션 진입: 사용자가 `/compound-resume` 명시 호출 시 가장 최근 1개 (`2026-04-28-compound-mmp-wave2-pr6.md`) read.

## 카논 ref 매트릭스

| 카논 | 위치 |
|------|------|
| 4단계 lifecycle | `refs/lifecycle-stages.md` |
| 7단계 wrap | `refs/wrap-up-checklist.md` + `skills/wrap-up-mmp/SKILL.md` |
| 13 anti-patterns | `refs/anti-patterns.md` |
| TDD soft ask | `refs/tdd-enforcement.md` |
| 5단계 dispatch 분류 | `refs/auto-dispatch.md` |
| 4-agent post-task-pipeline | `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json` |
| Q-gate (MISTAKES/QUESTIONS) | `refs/learning-quality-gate.md` |
| Sim Case A 카논 | `refs/sim-case-a.md` |
| OMC overlap spike | `refs/spike-omc-overlap.md` |

## 비기능 요구사항 (절대 위반 금지)

1. plan-autopilot 자동 진행 부활 X — 2026-04-21 폐기 결정 존중
2. user-home memory 작성 X — `memory/` (repo) canonical만 (`feedback_memory_canonical_repo.md`)
3. Sonnet 4.5 fallback X — 모든 sub-agent 4.6 / 검색 haiku-4-5 / 보안·아키텍처 opus-4-7 (`feedback_sonnet_46_default.md`)
4. graphify post-commit 자동 rebuild X — 정책 D (`project_graphify_refresh_policy.md`)
5. CLAUDE.md `@import` 사용 X — nested lazy-load 효과 0
6. 4-agent 리뷰 스킵 후 admin-merge X — PR-2c #107 재현 위험 (`feedback_4agent_review_before_admin_merge.md`)
7. MEMORY.md 카논 자동 덮어쓰기 X — entry append만 자동, 카테고리 변경은 승인
8. SessionStart hook 자동 inject 부활 X — 2026-04-28 폐기 결정, `/compound-resume` 명시 호출만 (anti-patterns #13)

## 외부 카논

- Plan 본문: `~/.claude/plans/vivid-snuggling-pascal.md` (4주 풀 라이프사이클 spec)
- CI: `.github/workflows/ci-hooks.yml` (ubuntu bash 5.x + macOS bash 3.2 matrix, shellcheck, hook self-tests)
- Plugin specs (Appendix A) — Superpowers·Compound·Session-Wrap·Corca·OMC 5 repo 비교 분석 결과 차용
