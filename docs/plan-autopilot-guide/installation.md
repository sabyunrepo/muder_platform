# plan-autopilot 설치 상세

> 부모: [../../PLAN_AUTOPILOT.md](../../PLAN_AUTOPILOT.md)

## 전제 조건

- **Claude Code v2.1.32+** (`claude --version` 으로 확인)
- **`jq`** — 모든 bash 스크립트 필수 (`brew install jq`)
- **`git`** — 버전 관리 + worktree 격리
- **`gh` CLI** (옵션) — PR 자동 생성/머지
- **`~/.claude/skills/plan-autopilot/`** — 스킬 디렉터리 존재 확인

```bash
# 전제 조건 검증
claude --version            # >= 2.1.32
jq --version                # 1.6+
git --version               # 2.30+
gh --version                # 2.0+ (옵션)
ls ~/.claude/skills/plan-autopilot/SKILL.md   # 존재해야 함
```

## 설치 단계

### 1. 슬래시 커맨드 복사 (필수)

```bash
mkdir -p .claude/commands
cp ~/.claude/skills/plan-autopilot/commands/*.md .claude/commands/
```

이유: Claude Code는 `.claude/commands/*.md` 만 슬래시 커맨드로 인식합니다. 스킬 디렉터리의 commands는 자동 로드되지 않음.

### 2. Hook 설정 (필수)

```bash
cp ~/.claude/skills/plan-autopilot/templates/settings.template.json .claude/settings.json
```

이미 `.claude/settings.json`이 있으면 **merge** 필요 (overwrite 금지):

```jsonc
{
  "hooks": {
    "SessionStart": [
      { "command": "~/.claude/skills/plan-autopilot/scripts/plan-status.sh --verbose" }
    ],
    "UserPromptSubmit": [
      { "command": "~/.claude/skills/plan-autopilot/scripts/plan-status.sh --compact" }
    ],
    "PreToolUse": [
      { "matcher": "Edit|Write", "command": "~/.claude/skills/plan-autopilot/scripts/plan-guard.sh" }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "command": "~/.claude/skills/plan-autopilot/scripts/plan-remind.sh" },
      { "matcher": "Read", "command": "~/.claude/skills/plan-autopilot/scripts/plan-track-reads.sh" }
    ]
  }
}
```

**핵심**: scripts는 `~/.claude/skills/plan-autopilot/scripts/` 절대 경로 참조. 프로젝트에 복사/심볼릭 링크 불필요. 스킬 업데이트가 자동 전파.

### 3. 파이프라인 설정 (필수)

```bash
cp ~/.claude/skills/plan-autopilot/templates/post-task-pipeline.template.json .claude/post-task-pipeline.json
```

그 다음 프로젝트에 맞게 커스터마이즈:
- `after_task[].command` → 프로젝트 테스트 러너로 변경 (`go test`, `pnpm test`, `cargo test` 등)
- `before_pr[].command` → lint, build 커맨드 (2026-05-01: `after_pr` → `before_pr` rename. PR 생성 *직전* 로컬에서 lint/test/4-agent review 일괄 수행 → push → CI 1회. 자세한 근거는 `memory/feedback_4agent_review_before_admin_merge.md`)
- `pr_model_overrides` → 특정 PR에 Opus 강제 지정
- `global.max_parallel_prs_per_wave` → CI 용량에 맞게 조정

### 4. CLAUDE.md 워크플로우 섹션 추가

```bash
cat ~/.claude/skills/plan-autopilot/templates/CLAUDE-md-section.template.md >> CLAUDE.md
```

이 섹션은 Claude에게 hook 동작 + 필수 규칙을 알립니다.

### 5. (옵션) .gitignore 추가

```gitignore
.claude/autopilot-state.json
.pr-body.tmp
```

Autopilot runtime state + 임시 PR body는 버전 관리 제외.

## 검증

설치 후 동작 확인:

```bash
# 1. 스크립트 실행 가능
~/.claude/skills/plan-autopilot/scripts/plan-status.sh --compact
# 출력: (empty — 아직 active plan 없음)

# 2. jq 동작
jq . .claude/post-task-pipeline.json | head

# 3. Claude Code에서 슬래시 커맨드 확인
# /plan-new, /plan-start, /plan-status, /plan-tasks 등이 자동완성되어야 함
```

## 첫 플랜 시작

```
/plan-new "My New Phase Name"
```

이 커맨드가 하는 일:
1. `superpowers:brainstorming` 호출 (Opus) → 7가지 설계 결정 수집
2. `superpowers:writing-plans` 호출 → PR breakdown + wave DAG
3. 템플릿 기반 docs 생성 (`docs/plans/YYYY-MM-DD-<slug>/`)
4. 모든 .md 파일 <200줄 강제
5. 초기 commit (문서 PR-0)

활성화:
```
/plan-start docs/plans/YYYY-MM-DD-<slug>
```

실행:
```
/plan-autopilot
```

## 업데이트

스킬 업데이트 시 프로젝트는 재설치 불필요 (scripts가 절대 경로 참조). 단, 새 슬래시 커맨드가 추가됐으면:

```bash
cp ~/.claude/skills/plan-autopilot/commands/*.md .claude/commands/
```

템플릿이 바뀌었으면 기존 설정은 유지하고 변경분만 수동 병합.

## 제거

```bash
rm -rf .claude/commands/plan-*.md
rm .claude/settings.json  # 또는 hooks 섹션만 제거
rm .claude/post-task-pipeline.json
rm -f .claude/active-plan.json .claude/autopilot-state.json
```

CLAUDE.md의 "Active Plan Workflow" 섹션도 수동 제거.

## 다중 프로젝트

같은 스킬을 여러 프로젝트에서 사용:
- 스킬은 `~/.claude/skills/plan-autopilot/` 에 **한 번만** 설치
- 각 프로젝트는 `.claude/` 설치 단계만 반복
- 프로젝트마다 독립된 `active-plan.json` + `post-task-pipeline.json` 유지
- 스킬 버전 업그레이드 시 모든 프로젝트가 동시 혜택
