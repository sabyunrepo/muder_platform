# mmp-pilot — 설계 + 구현 상태 인덱스

plan-* 체계 + mmp 하네스를 병합한 통합 파일럿 시스템.

## 구현 상태

| 단계 | 상태 | 내용 |
|------|------|------|
| M0 | ✅ 완료 | 신규 파일 생성 (plan-go, mmp-pilot 스킬, 스크립트 3종) |
| M1 | ✅ 완료 | `/plan-go`와 `/plan-autopilot` 공존, dual-write |
| M2 | ✅ 완료 | plan-autopilot에 deprecation 경고 |
| M3 | ⏸ 대기 | cutover 스크립트 준비 완료, Phase 18.3 종료 후 실행 |
| M4 | 📋 계획 | `m4-plan.md` 참조, 진입 조건 미충족 |

## 파일 맵

### 설계 문서
- [README.md](./README.md) — 이 파일
- [00-overview.md](./00-overview.md) §1-3
- [01-state-schema.md](./01-state-schema.md) §4-7
- [02-flow-and-files.md](./02-flow-and-files.md) §8-10
- [03-hooks-and-ab.md](./03-hooks-and-ab.md) §11-18
- [m4-plan.md](./m4-plan.md) — M4 활성화 절차·체크리스트

### 구현 산출물 (M0-M2)
| 파일 | 라인 | 역할 |
|------|------|------|
| `.claude/commands/plan-go.md` | 100 | 통합 진입점 커맨드 |
| `.claude/commands/plan-autopilot.md` | 수정 | M2 deprecation 경고 |
| `.claude/skills/mmp-pilot/SKILL.md` | 116 | Layer 1 오케스트레이터 |
| `.claude/skills/mmp-pilot/references/wave-engine.md` | 77 | wave+worktree 프로토콜 |
| `.claude/skills/mmp-pilot/references/ab-runner.md` | 138 | A/B 러너 상세(M4용) |
| `.claude/scripts/run-lock.sh` | 44 | 락 acquire/release/heartbeat |
| `.claude/scripts/run-wave.sh` | 107 | wave 매니페스트+worktree |
| `.claude/scripts/summary-parse.sh` | 66 | SUMMARY→checklist/progress |
| `.claude/scripts/m3-cutover.sh` | 74 | M3 전환 스크립트 (대기) |

## 사용법 (현재 M2 단계)

- **기존 plan-autopilot 계속 사용 가능** — Phase 18.3 영향 없음
- **신규 `/plan-go` 사용 권장** — 동일 기능 + `--task`, `--resume`, `--force-unlock`
- 메트릭 수집 시작: `memory/mmp-pilot-metrics.jsonl` (run 종료 시 append)

## 다음 단계

1. Phase 18.3 완료 후 `bash .claude/scripts/m3-cutover.sh` 실행 → M3
2. 메트릭 20 run 이상 누적 → M4 진입 조건 검토
3. M4 활성화 시 `m4-plan.md` §2 Step 1-6 순차 실행

## 무중단 보장

- `/plan-autopilot` 경로 유지(M3 cutover 전까지)
- active-plan.json schema v1/v2 dual read
- `_workspace/` 경로는 M3 cutover에서 일괄 치환
- M3 실행 시 `in_progress` 상태면 FORCE 확인 요구
