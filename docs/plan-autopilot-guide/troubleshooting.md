# 트러블슈팅

> 부모: [../../PLAN_AUTOPILOT.md](../../PLAN_AUTOPILOT.md)

## Hook 관련

### Hook이 전혀 안 돌아감

**증상**: SessionStart 메시지 안 보임, `/plan-*` 슬래시 커맨드 미인식

**확인**:
```bash
jq .active.id .claude/active-plan.json   # 활성 plan 있는지
jq . .claude/settings.json > /dev/null   # JSON valid
ls -la ~/.claude/skills/plan-autopilot/scripts/  # 755 권한
~/.claude/skills/plan-autopilot/scripts/plan-status.sh --compact  # 수동 실행
```

**해결**:
- active-plan.json 없음: `/plan-start <dir>`
- JSON parse error: `jq .` 재검증, archived에서 복구
- Script permission: `chmod +x ~/.claude/skills/plan-autopilot/scripts/*.sh`

### PreToolUse가 잘못 차단

**증상**: design.md 읽었는데도 "Not read recently" 에러

**원인**: `/tmp/claude-plan-read.log`의 파일 경로 매칭 실패 (절대 vs 상대)

**해결**:
```bash
cat /tmp/claude-plan-read.log | tail -20   # 기록 확인
rm /tmp/claude-plan-read.log               # 리셋 후 다시 Read
```

### Hook 일부만 동작

**원인**: matcher 패턴 또는 command 경로 오타

```bash
jq '.hooks.PreToolUse' .claude/settings.json
# matcher: "Edit|Write", command: 절대 경로
```

## Active plan 관련

### active-plan.json 손상

```bash
cp .claude/active-plan.json .claude/active-plan.json.broken
ls .claude/archived_plans/   # 복구 candidate
cp ~/.claude/skills/plan-autopilot/templates/active-plan.template.json .claude/active-plan.json
# 수동 편집: id, name, dir, scope, waves, prs
```

### Plan finish 실패

**증상**: `/plan-finish` 가 "tasks not all complete" 에러

**해결**:
1. `/plan-tasks` 로 미완료 확인
2. 완료된 task → `- [x]`
3. 건너뛸 task → `- [~]` 또는 삭제
4. force finish: "y" 응답

## Autopilot 관련

### Wave 중간 멈춤

```bash
cat .claude/autopilot-state.json 2>/dev/null
jq '.active.current_wave, .active.current_pr, .active.status' .claude/active-plan.json
```

- paused → `/plan-resume`
- blocker → 해결 후 수동 진행

### Fix-loop 3회 초과

**해결**:
1. git log로 마지막 sub-agent 작업 확인
2. findings 수동 검토 → 근본 문제 파악
3. 수동 수정 → `/plan-autopilot` 재개

### 병렬 wave merge 충돌

**원인**: 파일 스코프 설계 실수

**해결**:
```bash
~/.claude/skills/plan-autopilot/scripts/plan-wave.sh validate W4
```
겹친 파일 → 한 PR로 통합하거나 wave를 sequential로 변경:
```bash
jq '.active.waves[] |= if .id == "W4" then .mode = "sequential" else . end' \
   .claude/active-plan.json > tmp && mv tmp .claude/active-plan.json
```

## Slash command 관련

### 커맨드 미인식

```bash
ls .claude/commands/plan-*.md
cp ~/.claude/skills/plan-autopilot/commands/*.md .claude/commands/
# Claude Code 재시작
```

### `/plan-new`가 brainstorming 안 부름

**원인**: `superpowers:brainstorming` 스킬 없음

**해결**: `superpowers` 플러그인 설치 or 수동 브레인스토밍 후 `writing-plans`만 호출.

## 성능

### Hook 느림

- jq 설치 확인 (system-wide)
- 읽기 로그 cleanup: `wc -l /tmp/claude-plan-read.log` — 1000줄 넘으면 리셋
- active-plan.json 크기 — waves/prs 100개 넘으면 분할

### 병렬 wave 토큰 폭증

- `global.max_parallel_prs_per_wave` 2로 (4 → 2+2 분할)
- `pr_model_overrides`로 특정 PR sonnet 강제
- Wave sequential로 변경

## 복구

### 전체 리셋

```bash
/plan-stop
mv .claude/active-plan.json .claude/archived_plans/backup-$(date +%s).json
/plan-start <dir>
/plan-autopilot
```

### Hook 완전 비활성

```bash
mv .claude/active-plan.json .claude/active-plan.json.disabled
# 작업 후
mv .claude/active-plan.json.disabled .claude/active-plan.json
```

## 로그 수집 (문제 보고 시)

```bash
jq . .claude/settings.json
jq . .claude/post-task-pipeline.json
jq . .claude/active-plan.json
tail -50 /tmp/claude-plan-read.log
git log --oneline -20
claude --version
jq --version
```
