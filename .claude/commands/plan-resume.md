---
description: (sabyun) /clear 후 컨텍스트 복원 — QMD 기반 최소 로드. design/plan은 스킵 (편집 직전 PreToolUse가 강제 읽기)
allowed-tools: Read Bash(jq*) Bash(git*) Bash(cat*) Bash(*/plan-preflight.sh)
---

QMD 우선 복원 — 현재 PR spec + checklist만 로드. 전체 Read는 컨텍스트 낭비 (프로젝트 CLAUDE.md § QMD 강제 규칙).

## Pre-flight

!`$CLAUDE_PROJECT_DIR/.claude/scripts/plan-preflight.sh`

❌ 시 복원 계속 진행, 단 settings.json 수정이 첫 과제.

## Preload

### Active plan pointer
!`cat .claude/active-plan.json 2>/dev/null || echo "(no active plan)"`

### Git state
!`git log --oneline -5`
!`git status --short`
!`git branch --show-current`

---

## Steps

1. **active-plan.json에서 필드 추출** — `active.dir`, `active.current_pr`, `active.current_wave`, `active.current_task`, `active.status`, `active.checklist`, `active.scope[]`

2. **QMD 우선 로드 (이 순서대로, 절대 Read 금지)**:
   - 🔴 `qmd get "<active.dir>/refs/pr-<current_pr>-*.md"` — 현재 PR spec (다음 편집의 실제 소스)
   - 🔴 `qmd get "<active.checklist>"` — STATUS marker + 현재 PR 체크리스트 위치 파악
   - 조건부 — **blocker 플래그가 있거나 사용자가 명시 요청 시만**:
     - `qmd get "<active.progress_memory>"` (기본 스킵)
   - **절대 로드 금지** (PreToolUse guard가 편집 직전 자동 강제):
     - `design.md` — scope 편집 시 hook이 BLOCK → 그때 qmd get
     - `plan.md` — checklist와 정보 중복, 불필요
     - 전체 `refs/*` — 현재 PR 외 다른 PR은 편집 전까지 불필요

3. **요약 — 아래 템플릿에 맞춰 한 화면으로 보고**:

```
═══════════════════════════════════════════
 Plan Context Restored (QMD mode)
═══════════════════════════════════════════

Phase: <active.name>
Branch: <git current branch>

--- Current Position ---
Wave: <current_wave>
PR: <current_pr> — <title from PR spec>
Task: <current_task>
Status: <status>

--- Current PR Tasks (from checklist STATUS section) ---
<체크된 task + 미완료 task 구분해서 3~5개만>

--- Recent Commits ---
<git log -5 그대로>

--- Uncommitted ---
<git status --short 그대로>

--- Scope ---
<active.scope 3개 정도만 + 총개수>

--- Next Actions ---
1. Continue current task — 편집 시 PreToolUse가 design/checklist 자동 요구
2. /plan-go --resume — 파일럿 재개
3. /plan-tasks — 진행률 시각화
4. blocker 있으면 progress_memory 추가 로드 필요
```

**중요**:
- QMD `get` 실패 시 파일 경로 한 번 더 확인. Read 폴백 금지 (qmd-enforcer hook이 차단).
- design/plan 내용이 필요한 순간은 편집 직전 — PreToolUse가 자동으로 read 요구하므로 지금 미리 읽지 말 것. 토큰 5~10K 절감.
