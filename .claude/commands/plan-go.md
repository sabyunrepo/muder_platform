---
description: (mmp-pilot) 통합 진입점 — wave 자동 실행 + 단일 task + 재개. plan-autopilot 후계 (M1 dual-write 단계)
argument-hint: [--wave W2] [--task "id"] [--until WN] [--only PR-N] [--dry-run] [--resume] [--force-unlock] [--ab exp-id]
allowed-tools: Read Write Edit Bash Task
---

## 프리플라이트

!`$HOME/.claude/skills/plan-autopilot/scripts/plan-preflight.sh`

프리플라이트 ❌/🛑 시 중단. `jq . .claude/settings.json`으로 검증 후 재시도.

## 실행 단계

1. **락 확인** — `.claude/scripts/run-lock.sh check` 로 `.claude/run-lock.json` 상태 조회.
   - `owner != null` 이고 `last_heartbeat < 60min` → "다른 run 진행 중" 에러.
   - stale(≥60min) → `--force-unlock` 있어야 강제 해제.
2. **active-plan.json 로드** — schema_version 1/2 양쪽 지원. `current_run_id` 없으면 신규 `r-YYYYMMDD-HHMMSS-xxx` 생성.
3. **manifest 생성** — `.claude/runs/{run-id}/manifest.json`.
   - 기본: `current_wave`부터 순차. `--wave`/`--until`/`--only`로 범위 축소. `--task` 단일 실행.
4. **락 획득** — `run-lock.sh acquire <run-id> <wave> <pr> <task>`.
5. **모드 분기**:
   - `--dry-run` → manifest만 출력 후 종료.
   - `--ab <exp>` → `references/ab-runner.md` 참조 (M4 이후 활성, 현재는 스텁 메시지).
   - 일반 실행 → wave 루프 (§실행 루프).
6. **종료 시** — FINAL_SUMMARY 생성 + `run-lock.sh release`.

## 실행 루프

각 wave마다:

```bash
# 1. 의존성 / scope 오버랩 검증
$HOME/.claude/skills/plan-autopilot/scripts/plan-wave.sh validate <wave-id>

# 2. PR마다 worktree 생성 (parallel wave)
.claude/scripts/run-wave.sh create-worktrees <run-id> <wave-id>

# 3. task 루프 — mmp-pilot 스킬이 팀 편성·실행
#    각 task는 .claude/runs/{run-id}/{wave}/{pr}/{task}/ 하위에 산출
#    - 01_docs_context.md ~ 04_security_report.md
#    - SUMMARY.md (frontmatter 필수)
#    - logs/{team,hooks}.jsonl

# 4. SUMMARY 파싱 → checklist + progress 갱신
.claude/scripts/summary-parse.sh <run-id> <wave-id>

# 5. worktree 머지 (fast-forward)
.claude/scripts/run-wave.sh merge <run-id> <wave-id>

# 6. heartbeat 갱신
.claude/scripts/run-lock.sh heartbeat
```

## 팀 편성 규칙 (Layer 2)

task 성격에 따라 동적으로 2~6명 선정.

| task 키워드/패턴 | 편성 |
|------------------|------|
| security / redaction / token / auth | docs-navigator + go-backend + test + **security-reviewer** (4명) |
| module / genre / phase-reactor | docs-navigator + **module-architect** + go-backend + test (4명) |
| ws / session / engine 구현 | docs-navigator + go-backend + test (3명) |
| frontend / editor / canvas | docs-navigator + react-frontend + test (3명) |
| 풀스택 | docs-navigator + go-backend + react-frontend + test + security (5명) |
| 단순 조회/설계 질문 | docs-navigator 단독 |

팀 크기 상한은 `--team N` 플래그로 덮어쓰기. 기본: auto.

## M1 단계의 현재 동작 (dual-write)

- `/plan-go`는 신규 `.claude/runs/{run-id}/` 경로로 산출.
- 내부적으로 **기존 plan-autopilot 엔진**($HOME/.claude/skills/plan-autopilot/scripts/)을 재사용하여 wave/worktree 실행.
- 기존 `_workspace/` 경로는 더 이상 쓰지 않는다(하네스 통합분만 해당). autopilot 기존 산출물은 그대로 유지.
- `/plan-autopilot`은 여전히 동작(M2 deprecation 경고만). Phase 18.3 무중단.

## 에러 핸들링

- 락 획득 실패 → "run-lock.json에 소유자 있음" 상세 출력 + `--force-unlock` 안내.
- task 실패(SUMMARY.status=failed) → wave 내 후속 task 보류, 사용자에게 에스컬레이트.
- SUMMARY 누락 → `summary-require` hook이 재실행 요청.
- worktree 충돌 → `run-wave.sh abort <run-id>` 로 정리.

## 출력

- 진행 로그: `stdout` 요약 + `.claude/runs/{run-id}/stdout.log` 전문
- 최종: `runs/{run-id}/FINAL_SUMMARY.md` (wave별 SUMMARY 집계)
- 메트릭: `memory/mmp-pilot-metrics.jsonl` append

## 보조 커맨드

- 상태: `/plan-status` (run_id + heartbeat 경과 분 포함)
- 중단: `/plan-stop` → partial SUMMARY + 락 해제
- 재개: `/plan-go --resume` (current_run_id 이어받기)
- 단일 task: `/plan-go --task "M-7"` (in-place, worktree 없음)

## 참조

- 오케스트레이터 상세: `.claude/skills/mmp-pilot/SKILL.md`
- wave 엔진: `.claude/skills/mmp-pilot/references/wave-engine.md`
- A/B 러너(M4): `.claude/skills/mmp-pilot/references/ab-runner.md`
- 마이그레이션 상태: `.claude/designs/mmp-pilot/` + `m3-cutover.sh`
