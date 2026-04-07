# Hook 동작 상세

> 부모: [../../PLAN_AUTOPILOT.md](../../PLAN_AUTOPILOT.md)

## 4개 hook + 1개 read logger

모두 `.claude/settings.json` 에 등록. 활성 plan 있을 때만 발동, 없으면 no-op.

### SessionStart

**트리거**: 세션 시작, `/clear` 직후
**빈도**: 세션당 1회
**토큰 비용**: ~80
**명령**: `~/.claude/skills/plan-autopilot/scripts/plan-status.sh --verbose`

**출력 예시**:
```
=== ACTIVE PLAN ===
Phase: Phase 8.0 — Engine Integration Layer
Started: 2026-04-08

Current Wave: W1
Current PR: PR-1 — SessionManager + Session actor
Current Task: Implement Session.Run() event loop
Status: in_progress

=== STATUS MARKER ===
<!-- STATUS-START -->
**Active**: ...
**PR**: ...
**Task**: ...
<!-- STATUS-END -->

=== FILES ===
  Design: docs/plans/2026-04-08-engine-integration/design.md
  Checklist: docs/plans/2026-04-08-engine-integration/checklist.md
  Progress: memory/project_phase80_progress.md

=== SCOPE ===
  - apps/server/internal/session/**
  - apps/server/internal/ws/hub.go
  ...

Blockers: none
Commands: /plan-status /plan-tasks /plan-autopilot /plan-resume
```

Claude가 세션 시작 시 이 정보를 자동으로 context에 받아서 → 별도 조회 없이 작업 상태 파악.

### UserPromptSubmit

**트리거**: 매 사용자 메시지
**빈도**: 매 메시지
**토큰 비용**: ~25 (1줄)
**명령**: `~/.claude/skills/plan-autopilot/scripts/plan-status.sh --compact`

**출력**:
```
[ACTIVE PLAN: phase-8.0-engine-integration | W1 PR-1 | task: Session.Run() event loop | in_progress]
```

매 프롬프트 직전에 1줄이 system reminder로 주입됨 → Claude가 현재 상태를 항상 알고 있음.

### PreToolUse (Edit|Write) — **BLOCKING**

**트리거**: Edit/Write 도구 호출 직전
**빈도**: 매 Edit/Write
**blocking**: exit 2 (메시지 Claude에게 표시)
**명령**: `~/.claude/skills/plan-autopilot/scripts/plan-guard.sh`

**동작**:
1. `.claude/active-plan.json` 없으면 pass (exit 0)
2. `file_path`가 `active.scope` glob에 매치 안 되면 pass
3. 매치되면 `/tmp/claude-plan-read.log` 확인 — design + checklist가 최근 30분 내 Read됐는지
4. 둘 다 읽었으면 pass
5. 안 읽었으면 exit 2 + 에러 메시지 stderr

**차단 메시지 예시**:
```
🛑 PLAN GUARD: Active plan requires reading these before editing:
   File: apps/server/internal/session/manager.go
   ⚠️  Not read recently: docs/plans/2026-04-08-engine-integration/design.md

   Active plan: Phase 8.0 — Engine Integration Layer

   Action required:
   1. Read docs/plans/2026-04-08-engine-integration/design.md
   2. Read docs/plans/2026-04-08-engine-integration/checklist.md
   Then retry your edit.
```

Claude는 이 메시지를 받으면 자동으로 파일을 Read 후 Edit 재시도 → PreToolUse 재실행 → 이번엔 통과.

**설계 의도**: 실수로 design을 안 보고 코드 편집하는 것을 원천 차단.

### PostToolUse (Edit|Write)

**트리거**: Edit/Write 성공 직후
**빈도**: scope 매치 시
**blocking**: false (stderr 메시지만)
**명령**: `~/.claude/skills/plan-autopilot/scripts/plan-remind.sh`

**출력**:
```
📝 PLAN REMINDER: apps/server/internal/session/manager.go is in active plan scope (PR-1).
After this work segment, update:
  - docs/plans/2026-04-08-engine-integration/checklist.md (mark task ✅)
  - memory/project_phase80_progress.md (STATUS marker)
Also: ensure all modified .md files are <200 lines.
```

Claude는 이 리마인더를 받고 → 적절한 시점에 checklist/progress 갱신.

### PostToolUse (Read) — 로거

**트리거**: 매 Read 도구 호출 성공 직후
**빈도**: 매 Read
**명령**: `~/.claude/skills/plan-autopilot/scripts/plan-track-reads.sh`

**동작**: `/tmp/claude-plan-read.log`에 `{timestamp} {file_path}` 기록. 1시간 넘은 엔트리 자동 cleanup.

**용도**: PreToolUse guard가 "최근에 design 읽었는지"를 검증하는 데이터.

## Debugging

### Hook이 안 돌아감
```bash
# 1. 설정 확인
jq .hooks .claude/settings.json

# 2. 활성 plan 확인
jq .active.name .claude/active-plan.json

# 3. 스크립트 수동 실행
bash -x ~/.claude/skills/plan-autopilot/scripts/plan-status.sh --compact

# 4. 스크립트 실행 권한 확인
ls -l ~/.claude/skills/plan-autopilot/scripts/
```

### PreToolUse가 잘못 차단
```bash
# 읽기 로그 확인
cat /tmp/claude-plan-read.log

# Scope glob 매칭 수동 검증
file="apps/server/internal/session/manager.go"
jq -r '.active.scope[]' .claude/active-plan.json | while read g; do
  [[ "$file" == $g ]] && echo "MATCH: $g"
done

# 리셋
rm /tmp/claude-plan-read.log
```

### PreToolUse를 일시 우회
일반적으론 우회하지 않는 것이 원칙이지만, 긴급 fix 등에서 필요하면:
```bash
# 1. 잠시 active-plan.json 이름 변경
mv .claude/active-plan.json .claude/active-plan.json.bak

# 2. 작업 완료 후 복원
mv .claude/active-plan.json.bak .claude/active-plan.json
```

**권장하지 않음**: 대신 `/plan-stop` 사용 + 작업 후 `/plan-resume`.

## Hook lifecycle with plan state

| Plan state | SessionStart | UserPromptSubmit | PreToolUse | PostToolUse |
|-----------|--------------|------------------|-----------|-------------|
| 활성 + scope 매치 | 주입 | 주입 | enforce | 리마인더 |
| 활성 + scope 밖 | 주입 | 주입 | pass | pass |
| 활성 plan 없음 | no-op | no-op | no-op | no-op |
| 일시 정지 | 주입 (paused 표시) | 주입 | enforce | 리마인더 |
| archived | no-op | no-op | no-op | no-op |

## 다른 hook과 충돌

이미 `.claude/settings.json`에 다른 hook이 있으면 **merge** 필수:

```jsonc
{
  "hooks": {
    "SessionStart": [
      { "command": "existing-command" },
      { "command": "~/.claude/skills/plan-autopilot/scripts/plan-status.sh --verbose" }
    ]
  }
}
```

Claude Code는 같은 이벤트의 여러 hook을 순차 실행합니다.
