# mmp-pilot — 실행 흐름 + 파일별 변경 계획

## 8. 실행 흐름 시퀀스 3

### 8-A. 전체 wave 자동 실행 (`/plan-go`)
```
사용자       orchestrator        lock         worktree       team           hooks
  │─── /plan-go ───▶│                │            │             │              │
  │                 │─ acquire ─────▶│            │             │              │
  │                 │◀── locked ─────│            │             │              │
  │                 │─ load active-plan.json                                    │
  │                 │─ W0 parallel=true, prs=[PR-0,PR-1]                        │
  │                 │─────────────────▶ worktree PR-0 생성                      │
  │                 │─────────────────▶ worktree PR-1 생성                      │
  │                 │─ 팀 편성(PR-0): docs+go+test+security ──▶│                │
  │                 │                                          │─ Task 1 실행 ─▶│
  │                 │                                          │◀─ SUMMARY.md ──│
  │                 │─ checklist/progress 갱신                                   │
  │                 │─ worktree merge(fast-forward)                              │
  │                 │─ W1, W2…                                                   │
  │                 │─ release ─────▶│                                            │
  │◀── FINAL_SUMMARY ─│                                                            │
```

### 8-B. 단일 task 수동 (`/plan-go --task "M-7"`)
```
/plan-go --task "M-7"
  → acquire lock
  → manifest: 1 wave × 1 pr × 1 task (in-place, no worktree)
  → 팀 편성(task 성격 → security 중심 4인)
  → SUMMARY.md 생성
  → orchestrator가 checklist 해당 항목만 체크
  → release lock
```

### 8-C. 중단 후 재개 (`/plan-stop` → `/plan-go --resume`)
```
/plan-stop
  → orchestrator 신호 SIGUSR1
  → 현재 task의 SUMMARY(partial=true) 저장
  → worktree 그대로 유지
  → release lock
  ───────── (사용자 개입) ─────────
/plan-go --resume
  → active-plan.json에서 current_run_id 확인
  → run-lock acquire
  → 미완료 task 재개, 기존 worktree 재사용
  → SUMMARY(partial) + 신규 결과 병합
```

## 9. 파일별 변경 계획

### 신규 (created)
| 경로 | 내용 | 라인 상한 |
|------|------|----------|
| `.claude/commands/plan-go.md` | 통합 진입점 커맨드 | ≤200 |
| `.claude/skills/mmp-pilot/SKILL.md` | Layer 1 오케스트레이터 스킬(mmp-harness 흡수) | ≤200 |
| `.claude/skills/mmp-pilot/references/wave-engine.md` | wave 스케줄·worktree 프로토콜 | ≤200 |
| `.claude/skills/mmp-pilot/references/ab-runner.md` | A/B 러너 상세 | ≤200 |
| `.claude/scripts/run-lock.sh` | acquire/release/check/force-unlock/heartbeat | ≤50 |
| `.claude/scripts/run-wave.sh` | wave 매니페스트 생성·worktree 생성/머지 | ≤120 |
| `.claude/scripts/summary-parse.sh` | SUMMARY.md frontmatter → checklist/progress 반영 | ≤80 |
| `.claude/scripts/ab-runner.sh` | A/B variant 병렬 실행·METRICS.jsonl 기록·VERDICT 판정 | ≤150 |
| `memory/mmp-pilot-metrics.jsonl` | run-level 메트릭 (빈 파일로 초기화) | - |
| `.claude/proposals/README.md` | proposal 문서 규약 | ≤80 |

### 수정 (modified)
| 경로 | 변경 내용 |
|------|----------|
| `.claude/active-plan.json` | schema_version:2, runs{}, current_run_id 추가 |
| `.claude/commands/plan-start.md` | run_id 생성 + lock 준비 |
| `.claude/commands/plan-status.md` | 새 스키마 필드(run_id, heartbeat) 출력 |
| `.claude/commands/plan-tasks.md` | SUMMARY.md 존재 여부 반영 |
| `.claude/commands/plan-resume.md` | current_run_id 기반 resume |
| `.claude/commands/plan-stop.md` | 락 해제 + partial SUMMARY 저장 |
| `.claude/commands/plan-finish.md` | runs/{id}/FINAL_SUMMARY 승격 + archive |
| `.claude/agents/*.md` (6개) | "산출물은 `.claude/runs/{run-id}/{wave}/{pr}/{task}/` 하위에 저장" 명시, `_workspace/` 참조 제거 |
| `.claude/skills/mmp-harness/SKILL.md` | deprecated 안내 + mmp-pilot으로 리디렉션(또는 내부 전용) |
| `CLAUDE.md` | "하네스" 섹션 → "mmp-pilot 통합 시스템" 재기술, 변경 이력 추가 |
| `.claude/settings.json` | hook 경로 업데이트, 신규 hook 등록 |

### 제거/Deprecate
| 경로 | 처리 |
|------|------|
| `.claude/commands/plan-autopilot.md` | Phase 1: alias 스텁(`/plan-go`로 forward) → Phase 2: deprecation warning → Phase 3: 삭제 |
| 기존 autopilot 4 내장 리뷰어 정의 | 제거(하네스 6 에이전트로 대체) |
| 모든 `_workspace/` 참조 | `.claude/runs/` 경로로 치환 |
| `.claude/post-task-pipeline.json`의 autopilot 전용 후크 | `.claude/runs/` 기반으로 재작성 |

## 10. 마이그레이션 타임라인

| 단계 | 기간 | 조치 |
|------|------|------|
| **M0 준비** | 1일 | 신규 파일 추가, 기존 파일 건드리지 않음. Phase 18.3는 autopilot으로 계속 |
| **M1 alias** | 1주 | `/plan-autopilot` → `/plan-go` forward. 동일 동작 확인. `_workspace/` → `.claude/runs/` 이중 기록 |
| **M2 warning** | 1주 | autopilot 호출 시 "deprecated, use /plan-go" 경고 STDERR. 기존 plan 이어서 가능 |
| **M3 전환** | 1일 | Phase 18.3 종료 후 신규 Phase부터 `/plan-go` 전용. autopilot.md 삭제, `_workspace/` 참조 제거 |
| **M4 안정화** | 2주 | 메트릭 수집, 첫 proposal, 회귀 모니터 |

**무중단 조건**: M1-M2 동안 active-plan.json schema_version 1/2 모두 읽을 수 있도록 parser에 fallback.
