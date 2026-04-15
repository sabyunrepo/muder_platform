# mmp-pilot — 상태 스키마 + 산출물 경로

## 4. active-plan.json 확장 JSON

```json
{
  "schema_version": 2,
  "active": {
    "id": "phase-18.3-cleanup",
    "name": "Phase 18.3 보안 하드닝 + CI 정비",
    "dir": "docs/plans/2026-04-15-phase-18.3-cleanup",
    "design": "...design.md",
    "plan": "...plan.md",
    "checklist": "...checklist.md",
    "progress_memory": "memory/project_phase183_progress.md",
    "scope": ["apps/server/internal/session/**", "..."],
    "started_at": "2026-04-15",
    "started_commit": "a12b2f4",

    "current_run_id": "r-20260415-091230-ab3",
    "current_wave": "W0",
    "current_pr": "PR-0",
    "current_task": "Task 1 — M-7 Recovery path snapshot redaction",
    "status": "in_progress",
    "blockers": [],

    "waves": [
      {
        "id": "W0",
        "name": "보안 + CI 병렬",
        "mode": "parallel",
        "prs": ["PR-0", "PR-1"],
        "tasks": {
          "PR-0": ["Task 1 — M-7", "Task 2 — 감사로그"],
          "PR-1": ["Task 1 — golangci", "Task 2 — eslint"]
        }
      }
    ],

    "runs": {
      "r-20260415-091230-ab3": {
        "started_at": "2026-04-15T09:12:30Z",
        "mode": "wave|single|ab",
        "worktrees": {
          "PR-0": ".claude/worktrees/phase-18.3-PR-0",
          "PR-1": ".claude/worktrees/phase-18.3-PR-1"
        },
        "team": ["docs-navigator","go-backend","test","security"],
        "state": "running|completed|stopped|failed"
      }
    }
  }
}
```

## 5. run-lock.json 스키마 + 상태 다이어그램

**파일**: `.claude/run-lock.json` (단일, 동시성 제어)

```json
{
  "owner_pid": 43217,
  "run_id": "r-20260415-091230-ab3",
  "acquired_at": "2026-04-15T09:12:30Z",
  "last_heartbeat": "2026-04-15T09:18:02Z",
  "wave": "W0",
  "pr": "PR-0",
  "task": "Task 1 — M-7",
  "worktree": ".claude/worktrees/phase-18.3-PR-0",
  "ab_experiment": null
}
```

**상태 전이**:
```
       /plan-go
    ┌──────────┐  acquire    ┌──────────┐
    │  idle    │────────────▶│  locked  │
    └──────────┘             └────┬─────┘
         ▲                        │
         │ release (success/stop) │ heartbeat(60s)
         │                        ▼
         │                   ┌──────────┐
         └───────────────────│ finished │
              stale(60min)   └──────────┘
              → force-unlock
```

**Stale 판정**: `last_heartbeat` 기준 60분 이상 없으면 stale. `/plan-go --force-unlock` 또는 `run-lock.sh force` 로 해제.

## 6. `.claude/runs/` 디렉터리 트리

```
.claude/runs/
└── r-20260415-091230-ab3/        ← run_id
    ├── manifest.json              ← wave/pr/task 스냅샷
    ├── W0/
    │   ├── PR-0/
    │   │   ├── Task-1/
    │   │   │   ├── 01_docs_context.md
    │   │   │   ├── 02_go_changes.md
    │   │   │   ├── 03_test_report.md
    │   │   │   ├── 04_security_report.md
    │   │   │   ├── SUMMARY.md            ← orchestrator 파싱 대상
    │   │   │   └── logs/
    │   │   │       ├── team.jsonl        ← 팀 메시지 로그
    │   │   │       └── hooks.jsonl       ← scope/qmd/200-line hook 이벤트
    │   │   └── Task-2/…
    │   └── PR-1/…
    ├── ab/                                ← --ab 모드만 생성
    │   └── exp-team-size-2vs4/
    │       ├── A/ (기존 구조 동일)
    │       ├── B/
    │       ├── METRICS.jsonl
    │       └── VERDICT.md
    └── FINAL_SUMMARY.md                   ← run 종료 시 집계
```

**worktree 내부 vs 메인 repo**: `.claude/runs/`는 **메인 레포**에만 둔다(워크트리마다 복제하면 집계 어려움). 워크트리에서 쓴 산출물은 merge 시 main의 `.claude/runs/{run-id}/W?/PR-?/…`로 상대경로 기록.

## 7. SUMMARY.md 스키마 (YAML frontmatter)

```yaml
---
run_id: r-20260415-091230-ab3
wave: W0
pr: PR-0
task: "Task 1 — M-7 Recovery path snapshot redaction"
status: completed | failed | blocked
agents_used: [docs-navigator, go-backend-engineer, test-engineer, security-reviewer]
started_at: 2026-04-15T09:12:30Z
ended_at: 2026-04-15T09:28:44Z
duration_sec: 974

files_changed:
  - path: apps/server/internal/session/snapshot.go
    lines_before: 142
    lines_after: 178
    lint: pass
  - path: apps/server/internal/session/snapshot_test.go
    lines_before: 0
    lines_after: 96
    lint: pass

line_counts:
  total_added: 112
  total_removed: 24
  max_file_lines: 178
  violations_200: 0

tests:
  run: 18
  passed: 18
  failed: 0
  skipped: 0
  coverage_delta: "+2.4%"

security:
  blockers: []
  findings_high: 0
  findings_medium: 1
  findings_low: 2
  redaction_applied: true

hooks:
  scope_violations: 0
  qmd_blocks: 0
  line_rule_blocks: 0

next_actions:
  - "checklist의 Task 1 체크 표시"
  - "memory/project_phase183_progress.md에 M-7 결과 append"
---

# Task 1 — M-7 Recovery path snapshot redaction

## 수행 작업
- ...

## 미해결
- Medium: … (후속 task 권고)
```

Orchestrator(Layer 1)가 이 frontmatter만 파싱해도 checklist·progress 자동 갱신 가능.
