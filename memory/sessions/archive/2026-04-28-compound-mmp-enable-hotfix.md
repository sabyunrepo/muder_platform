---
topic: "compound-mmp 플러그인 enable hotfix 후 — Wave 2 PR-6 진입 직전"
phase: "Wave 2 (P0 hotfix 해소 후, PR-6 진입 직전)"
prs_touched: [PR-#154]
session_date: 2026-04-28
---

# Session Handoff: compound-mmp enable hotfix 후 (PR-6 진입 직전)

## Decided

- **`compound-mmp` 플러그인 활성화 완료** — PR #154 머지 (`8190ce7`). `.claude/plugins/.claude-plugin/marketplace.json` 신규(directory marketplace `ctm`) + `.claude/settings.json`에 `extraKnownMarketplaces.ctm` + `enabledPlugins["compound-mmp@ctm"]` 등록. 이전 세션 마지막에 `/compound-resume` Unknown command가 발생한 P0 원인 해소.
- **marketplace 이름 = `ctm`** — 사용자 확정 (handoff `local`/제안 `mmp-local`/`compound-mmp-local` 모두 reject). 짧고 schema 정합 (`name@marketplace` 형식).
- **marketplace 구조** — repo-local `directory` source. marketplace root = `.claude/plugins/`, plugin source = `./compound-mmp` 상대 경로. `harness@harness-marketplace`(user home github source)와 범위 분리(global vs project-local) 명확.
- **4-agent 리뷰 → 3-agent로 축소** — settings/marketplace JSON 변경 한정 PR이라 perf agent N/A. security/architecture/test 3-agent 모두 P0 0건 APPROVED.

## Rejected

- ~~marketplace.json 없이 enabledPlugins만 1줄 추가~~ → 불가능 (Claude Code는 marketplace 통해서만 plugin 등록 인식)
- ~~marketplace 이름 `local` (handoff 원안)~~ → reject (너무 generic, 사용자 `ctm` 선택)
- ~~`mmp-local` / `compound-mmp-local`~~ → reject (사용자 `ctm` 짧은 약어 선호)
- ~~perf agent 4번째 띄우기~~ → N/A (config-only PR, 코드 0줄)

## Risks

- **첫 dogfooding 세션 = 다음 세션** — 새 세션 시작 시 PR-5 hook(size check, TDD soft ask) + slash command(`/compound-resume`, `/compound-wrap`)이 처음 실 발화. PR-6 작업 중 PreToolUse ask interrupt 노출됨. "정상 발화" vs "오작동" 구분 주의 — 의심 시 핸드오프의 dogfooding 체크리스트 우선 확인.
- **`/compound-resume` 동작 미검증 (carry-over)** — 카논 정의는 머지(#152)됐지만 슬래시 디스패처에서 실제 description대로 read 수행하는지 실측은 다음 세션에서 처음. 실패 시 description 보강 (예: 명시적 read 단계 나열).
- **Carry-over P1 2건** (이 PR scope 외, follow-up):
  - `.claude/plugins/compound-mmp/hooks/dispatch-router.sh`: `classify()` 내 `shopt -s nocasematch` 복원 누락 경로 존재. 독립 프로세스라 실해는 없으나 `trap 'shopt -u nocasematch' RETURN`으로 보강 권장.
  - `memory/MEMORY.md`에 `ctm` marketplace 등록 사실 미반영. 다음 wrap에서 `reference_compound_mmp_marketplace.md` 또는 기존 `reference_*.md` append.
- **CI admin-skip 정책 활성** — 모든 PR `gh pr merge --admin` 머지 카논 (memory `project_ci_admin_skip_until_2026-05-01.md`). PR-6도 동일 패턴.
- **graphify-out 미커밋** — 정책 D 일상 commit 금지 유지.

## Files

### 이번 세션 main 변경 (PR #154, `8190ce7`)
- NEW: `.claude/plugins/.claude-plugin/marketplace.json` (directory marketplace `ctm`, compound-mmp 1개 entry)
- MOD: `.claude/settings.json` (extraKnownMarketplaces.ctm + enabledPlugins["compound-mmp@ctm"])

### 미작성 (다음 wrap에서 첫 사용)
- `memory/MISTAKES.md` (Stage 4 출력 대상)
- `memory/QUESTIONS.md` (Stage 5 출력 대상)
- `memory/MEMORY.md` 인덱스 갱신 (`ctm` marketplace + PR #154 항목)

## Remaining

### Wave 2 PR-6 (즉시 진입 — 다음 세션 main 작업)
- **`pre-task-model-guard.sh`** — Sonnet 4.5 차단 + 4.6 안내. PreToolUse(Task) hook 등록.
- bats 테스트 fixture (model-guard) + CI matrix (bash 3.2 macOS / 5.x Linux 모두 PASS 필수).
- branch: `feat/compound-mmp/PR-6-task-model-guard` (main 직접 분기).
- SessionStart 작업 폐기 — 이미 #152에서 카논화 (anti-patterns #13).

### 후속 PR (Wave 3/4 — 기존 카논)
- PR-7: `/compound-review` + post-task-pipeline 4-agent 브릿지 + P0–P3 라우팅
- PR-8: `/compound-plan` + qmd-recall 스킬
- PR-9: `/compound-work` + worktree + TDD 가드 + 2-stage subagent review
- PR-10: `/compound-cycle` + 시뮬레이션 검증 (Case A/B/C) + 1주 dogfooding

### Carry-over P1 (이 hotfix scope 외, follow-up)
- dispatch-router.sh `shopt -u nocasematch` 복원 (별도 small PR 또는 PR-6에 piggyback)
- memory/MEMORY.md `ctm` marketplace 인덱스 추가 (다음 wrap)

## Next Session Priorities

1. **`/compound-resume` 호출** — 다음 세션 첫 메시지로 명시 호출. 메인이 이 핸드오프 + plan + 카논 cheat-sheet read. 활성화 후 첫 동작 검증을 겸함.
2. **`/compound-resume` 동작 검증** — description대로 read 수행하는지 실측. 실패 시 #152의 description 보강.
3. **Wave 2 PR-6 진입** — `pre-task-model-guard.sh` 단독.
4. **dogfooding 신호 관찰** — PR-6 작업 중 size hook 차단(혹시 발생 시) + TDD ask가 자연스럽게 발화하는지. 1회 이상 dogfooding 후 carry-over P1 처리.

## What we did

이전 세션 마지막에 사용자가 `/compound-resume` 시도 → "Unknown command". 원인 진단: `compound-mmp` 플러그인이 `.claude/settings.json` `enabledPlugins`에 미등록. handoff에 "1줄 추가" P0 hotfix로 명시되어 있었으나 실제로는 marketplace 등록이 선행 필요했음.

해결 흐름:
1. `harness@harness-marketplace` 등록 패턴 분석 (user home `extraKnownMarketplaces`에 github source).
2. compound-mmp는 repo-local이므로 `directory` source가 적합 — `.claude/plugins/.claude-plugin/marketplace.json` 신규 작성.
3. marketplace 이름 사용자 확정 = `ctm`.
4. PR #154 생성, 3-agent 병렬 리뷰 (security/architecture/test) 모두 P0 0건 APPROVED, perf는 N/A.
5. admin-merge → `8190ce7` fast-forward.

## What blocked us

- handoff의 "1줄 추가" 추정이 incorrect → marketplace 등록 선행 필수 발견에 1 round-trip 소요. 사용자에게 marketplace 이름 옵션 제시 후 `ctm` 확정.
- 새 marketplace.json 작성 중 plugin source 상대 경로 기준점 확인 필요 (`./compound-mmp`이 marketplace root `.claude/plugins/` 기준이라는 schema 의도). 아키텍처 agent가 검증으로 확정.

## Next session 첫 5초

- **첫 메시지**: `/compound-resume` (한 마디).
- **메인의 첫 read 대상**: 이 파일 (`memory/sessions/2026-04-28-compound-mmp-enable-hotfix.md` — 가장 최근 mtime).
- **그 다음 read**: `~/.claude/plans/vivid-snuggling-pascal.md` § Wave 2 PR-6 spec (line 224 부근).
- **이후 read 후보** (사용자 발화 기반):

| 룰 | 위치 |
|----|------|
| 4단계 라이프사이클 | `.claude/plugins/compound-mmp/refs/lifecycle-stages.md` |
| 13 anti-patterns (#13 SessionStart inject 폐기) | `refs/anti-patterns.md` |
| TDD soft ask 정책 | `refs/tdd-enforcement.md` |
| 5단계 dispatch | `refs/auto-dispatch.md` |
| 4-agent post-task-pipeline | `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json` |
| `/compound-resume` 카논 | `commands/compound-resume.md` + `templates/session-recall-template.md` |

- **미해결 사용자 결정**: 없음. PR-6 진입은 plan에 spec 확정.
- **dogfooding 첫 신호 — PR-6 작업 중 hook 발화 시 정상**:
  - PreEdit size hook → Go 500/함수 80, TS·TSX 400/함수 60·컴포넌트 150 한도 초과 시 ask interrupt
  - TDD soft ask → Go/React 코드 신규 작성 시 "테스트부터 작성하시겠어요?" 1회 ask
  - 둘 다 정상 동작이면 진행, 의심 시 `refs/anti-patterns.md` 확인 후 disable env var 사용 (`COMPOUND_MMP_TDD_ASK_DISABLE` 등).
- **bash 3.2 호환** — 신규 hook 작성 시 `${var,,}` / mapfile / readarray / declare -gA 금지. CI macOS step에서 catch.

## 카논 이정표

| 카논 | 위치 |
|------|------|
| compound-mmp plugin manifest | `.claude/plugins/compound-mmp/.claude-plugin/plugin.json` |
| compound-mmp marketplace (this PR) | `.claude/plugins/.claude-plugin/marketplace.json` |
| 활성화 entry | `.claude/settings.json` `enabledPlugins["compound-mmp@ctm"]` |
| plan 본문 | `~/.claude/plans/vivid-snuggling-pascal.md` |
| 직전 핸드오프 (PR #150-152 통합) | `memory/sessions/2026-04-28-compound-mmp-resume-slash.md` |
