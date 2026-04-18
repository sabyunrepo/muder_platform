---
name: plan-go 커맨드 ↔ plan-autopilot 스킬 연결
description: 프로젝트의 /plan-* 커맨드가 ~/.claude/skills/plan-go/ 경로를 참조하지만 실제 스킬은 plan-autopilot. symlink 필요
type: reference
originSessionId: db46cd3e-7369-4f7a-b06e-2697758a806c
---
프로젝트 `.claude/commands/plan-*.md` 파일들이 `$HOME/.claude/skills/plan-go/scripts/...` 경로의 스크립트(`plan-preflight.sh`, `plan-status.sh`, `plan-tasks.sh`, `autopilot-loop.sh`)와 `templates/`, `refs/` 를 참조한다. 글로벌 스킬은 `~/.claude/skills/plan-autopilot/`만 존재 — `/plan-go`가 plan-autopilot의 후계라서 디렉터리 구조가 동일하므로 symlink로 해결.

**설정 명령** (재설치/새 머신 시):
```bash
ln -s plan-autopilot ~/.claude/skills/plan-go
```

**알려진 추가 버그** (2026-04-15 패치):
- `~/.claude/skills/plan-autopilot/scripts/plan-tasks.sh` L24-25: `grep -c ... || echo 0` 이디엄이 grep -c (0 매치 시 exit 1) 와 충돌해 multiline 값 생성 → 산술 오류. `; true` + `${VAR:-0}` 패턴으로 수정됨.

**관련 구조:**
- `.claude/active-plan.json` — 활성 plan 포인터 (active.dir/design/plan/checklist 필드 + waves[] + prs{} 정식 스키마)
- 프로젝트 로컬 스크립트: `.claude/scripts/run-lock.sh`, `run-wave.sh`, `summary-parse.sh` (mmp-pilot M1+)
- 글로벌 엔진: `~/.claude/skills/plan-autopilot/scripts/` (plan-go에서 dual-write 재사용)
