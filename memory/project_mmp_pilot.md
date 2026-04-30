---
name: mmp-pilot 통합 시스템 (M0-M3 cutover 완료)
description: plan-* 체계와 mmp 하네스를 병합한 단일 파일럿 시스템. /plan-go 단일 진입점, 3-Layer 구조, A/B 자기개선 루프(M4 계획). M3 cutover 2026-04-15 commit cdd498e 완료 — plan-autopilot 제거.
type: project
originSessionId: 4b31801f-3661-4beb-a250-8271acf17e79
---
# mmp-pilot — plan-autopilot + mmp 하네스 통합 시스템

2026-04-15 구축. **M3 cutover 완료** (commit `cdd498e`) — `/plan-go` 단일 체계 확립. M4는 계획 문서만.

## 아키텍처 (3-Layer)
- **Layer 1 오케스트레이터**: `.claude/skills/mmp-pilot/SKILL.md` — wave 루프 + worktree + 락 + SUMMARY 파싱
- **Layer 2 동적 팀**: 6 에이전트(docs-navigator/go-backend/react-frontend/module-architect/test/security), 2~6명 동적 편성
- **Layer 3 공용 스킬**: mmp-qmd-first · mmp-200-line-rule · mmp-module-factory · mmp-test-strategy · mmp-security-rfc9457

## 단일 진입점
`/plan-go` — `.claude/commands/plan-go.md`
- 플래그: `--wave`, `--task`, `--until`, `--only`, `--dry-run`, `--resume`, `--force-unlock`, `--ab`
- 산출물: `.claude/runs/{run-id}/{wave}/{pr}/{task}/NN_agent_artifact.md` + `SUMMARY.md`
- 락: `.claude/run-lock.json` (heartbeat 60초, stale 60분)
- 메트릭: `memory/mmp-pilot-metrics.jsonl` (run 종료 시 append)

## 마이그레이션 상태
- **M0**: 신규 파일 추가 완료 (plan-go, mmp-pilot 스킬, run-lock.sh, run-wave.sh, summary-parse.sh)
- **M1**: dual-write 완료 (/plan-go 병행 운영 가능)
- **M2**: plan-autopilot에 Deprecation 경고 배너 추가
- **M3**: ✅ 완료 (2026-04-15, commit `cdd498e`). `m3-cutover.sh` 실행 → `plan-autopilot.md` 삭제 (백업 `.claude/m3-backup-20260415-095810/`), plan-* 커맨드 참조 `/plan-go` 치환, post-task-pipeline 4 내장 리뷰어 정의 제거, CLAUDE.md Active Plan Workflow 섹션 갱신.
- **M4**: 계획만 문서화 `.claude/designs/mmp-pilot/m4-plan.md` (A/B 러너 + 자기개선 루프, 20 run 누적 후 활성화)

## 핵심 파일 지도
| 역할 | 경로 |
|------|------|
| 설계 인덱스 | `.claude/designs/mmp-pilot/README.md` |
| 설계 상세 | `.claude/designs/mmp-pilot/{00-overview,01-state-schema,02-flow-and-files,03-hooks-and-ab,m4-plan}.md` |
| 커맨드 | `.claude/commands/plan-go.md` (단일 진입점) — `plan-autopilot.md`는 M3에서 제거 |
| 오케스트레이터 스킬 | `.claude/skills/mmp-pilot/SKILL.md` + `references/{wave-engine,ab-runner}.md` |
| 스크립트 | `.claude/scripts/{run-lock,run-wave,summary-parse,m3-cutover,handoff-from-autopilot}.sh` |
| 에이전트 (Layer 2) | `.claude/agents/{docs-navigator,go-backend-engineer,react-frontend-engineer,module-architect,test-engineer,security-reviewer}.md` |
| 공용 스킬 (Layer 3) | `.claude/skills/{mmp-qmd-first,mmp-200-line-rule,mmp-module-factory,mmp-test-strategy,mmp-security-rfc9457}/SKILL.md` |
| 레거시 참조 | `.claude/skills/mmp-harness/SKILL.md` (deprecated, 팀 편성 규칙 참조만) |

## Phase 18.3과의 관계 (회고)
- Phase 18.3은 기존 `/plan-autopilot`으로 W0~W2 완주 (PR-0~PR-4 모두 머지, archive `phase-18.3-cleanup.json`).
- Phase 18.3 종료 직후 `m3-cutover.sh` 실행 → 다음 Phase부터 `/plan-go` 전용.

## 중요 규칙 (재확인)
- 파일 크기 티어 — Go 500/함수 80, TS·TSX 400/함수 60·컴포넌트 150, MD 200 (`feedback_file_size_limit.md` 참조, 2026-04-15 변경)
- QMD MCP 우선(docs/plans, memory, docs/superpowers)
- Layer 2 팀원은 `.claude/runs/{run-id}/{wave}/{pr}/{task}/` 경로로 산출물 작성
- `_workspace/` 경로는 더 이상 사용 금지 (M3에서 일괄 치환 완료)
