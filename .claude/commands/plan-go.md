---
description: (mmp-pilot) 통합 진입점 — wave 자동 실행 + 단일 task + 재개. plan-autopilot 후계 (M3 cutover 완료)
argument-hint: [--wave W2] [--task "id"] [--until WN] [--only PR-N] [--dry-run] [--resume] [--force-unlock] [--ab exp-id]
allowed-tools: Read Write Edit Bash Task
---

## 프리플라이트

!`$CLAUDE_PROJECT_DIR/.claude/scripts/plan-preflight.sh`

프리플라이트 ❌/🛑 시 중단. `jq . .claude/settings.json`으로 검증 후 재시도.

## 실행

**상세 Phase 로직·팀 편성 규칙·에러 핸들링은 `.claude/skills/mmp-pilot/SKILL.md`가 단일 소스.** 이 커맨드는 entry point + 락 관리 + 재개 옵션만 담당.

핵심 시퀀스:

1. **락 확인** — `.claude/scripts/run-lock.sh check`. owner≠null 이고 heartbeat<60min 이면 차단. stale(≥60min)은 `--force-unlock` 필요.
2. **active-plan.json 로드** — schema_version 1/2 지원. `current_run_id` 없으면 신규 `r-YYYYMMDD-HHMMSS-xxx`.
3. **manifest 생성** — `.claude/runs/{run-id}/manifest.json`. 기본 `current_wave`부터 순차. 플래그:
   - `--wave W2` / `--until WN` / `--only PR-N` — 범위
   - `--task "M-7"` — 단일 실행 (worktree 없음, in-place)
   - `--dry-run` — manifest 출력 후 종료
   - `--resume` — current_run_id 이어받기 → 미완료 task부터
   - `--ab <exp>` — M4 이후 활성 (현재 스텁)
4. **락 획득** → mmp-pilot Phase 2~5 루프 → FINAL_SUMMARY → 락 release

## 서브에이전트 모델 지정

mmp-pilot이 Layer 2 팀원 spawn 시 **일반 구현·리뷰는 `claude-sonnet-4-6`**, **security / architecture 판단은 `claude-opus-4-7`**. 4.5는 사용 금지(4.6 출시 이후).

## 에러·산출물 경로

- 산출물: `.claude/runs/{run-id}/{wave}/{pr}/{task}/NN_agent_artifact.md` + `SUMMARY.md`
- 로그: `stdout` 요약 + `.claude/runs/{run-id}/stdout.log` 전문
- 메트릭: `memory/mmp-pilot-metrics.jsonl` append

상세 에러 분류·scope enforcement·팀 크기 가이드는 mmp-pilot/SKILL.md §팀 크기 + §에러 핸들링 참조.

## 보조 커맨드

- 상태: `/plan-status` — run_id + heartbeat 경과 포함
- 중단: `/plan-stop` — partial SUMMARY + 락 해제
- 재개: `/plan-go --resume`
- 단일 task: `/plan-go --task "M-7"`

## 참조

- 오케스트레이터: `.claude/skills/mmp-pilot/SKILL.md`
- wave 엔진: `.claude/skills/mmp-pilot/references/wave-engine.md`
- A/B(M4): `.claude/skills/mmp-pilot/references/ab-runner.md`
