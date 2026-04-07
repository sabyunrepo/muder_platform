# Wave 기반 병렬 실행 모델

> 부모: [../design.md](../design.md)

---

## PR 의존성 DAG

```
Level 0:  PR-1 (SessionManager skeleton)
              │
              ├──────────────────┐
Level 1:  PR-2 (Hub lifecycle)  (...)
              │
Level 2:  PR-3 (BaseModuleHandler + EventMapping infra)
              │
Level 3:  PR-4 (Reading wired — 패턴 레퍼런스)
              │
              ├────────┬────────┬────────┐
Level 4:  PR-5       PR-6     PR-7     PR-8
          Core 4     Prog 8   Snapshot  Start API
              │        │        │        │
              └────────┴────┬───┴────────┘
                            │
Level 5:          PR-9 (Observability)
```

**단, PR-7은 Level 1에 놓을 수도 있음** (PR-2와 병렬) — PR-1만 필요하고 파일 독립. 하지만 Wave 1을 작게 유지(2 PR)하고 PR-7을 Wave 4에 두면 Wave 4의 병렬 이득을 극대화. 최종 선택: **Wave 4에 두되, Wave 1 일찍 끝나면 PR-7을 앞당겨 실행 가능** (optional).

---

## Wave 5개 구성

### Wave 1: 독립 Skeletons (병렬 ×2)
- **PR-1**: SessionManager + Session actor skeleton
- **PR-2**: Hub lifecycle listener (interface + RegisterLifecycleListener)
- Scope 완전 독립: `internal/session/*` vs `internal/ws/hub.go`
- **예상 wall-clock**: max(PR-1, PR-2) ≈ PR-1 시간

### Wave 2: 인프라 (순차)
- **PR-3**: BaseModuleHandler + EventMapping 테이블 인프라
- W1 양쪽 인터페이스 import 필요 → 순차 필수

### Wave 3: 패턴 레퍼런스 (순차)
- **PR-4**: Reading 모듈 wired
- 모든 후속 모듈 wiring의 **패턴 레퍼런스**. 순차 필수
- 이 PR이 확정되어야 PR-5~8이 복사 가능한 패턴을 보유

### Wave 4: 병렬 wiring (병렬 ×4) ⚡⚡⚡⚡
- **PR-5**: Core 4 modules (connection, room, ready, clue_interaction)
- **PR-6**: Progression 7 modules (script/hybrid/event/skip_consensus/gm_control/consensus_control/ending)
- **PR-7**: Redis snapshot + Lazy restore
- **PR-8**: Game start API (`POST /api/v1/rooms/{id}/start` + abort + idle timeout)
- **예상 wall-clock**: max(PR-5, PR-6, PR-7, PR-8) ≈ PR-6 시간

### Wave 5: 전역 관통 (순차)
- **PR-9**: Observability (모든 파일에 metric/trace 주입)
- W4 머지 후에만 안정적 실행 가능

---

## 속도 개선 추정

| 실행 방식 | 단위 시간 | 비고 |
|----------|----------|------|
| 완전 순차 (9 PR 직렬) | 9T | 기존 설계 |
| Wave 기반 병렬 | **5T** | W1, W4 병렬로 4개 단축 |
| 단축율 | **~44%** | |

Wave 4가 가장 큰 기여 (4 PR 동시).

---

## 병렬 실행 메커니즘 (Agent tool)

Agent 도구의 `isolation: "worktree"` 파라미터:

> "You can optionally set `isolation: \"worktree\"` to run the agent in a temporary git worktree, giving it an isolated copy of the repository."

각 병렬 sub-agent가 **자체 git worktree**에서 작업 → 파일 충돌 원천 차단.

### Wave 4 실행 예시

```
Main orchestrator가 한 메시지에 4개 Agent tool_use 블록 (진짜 병렬):

Agent A: PR-5   isolation: worktree   branch: feat/phase-8.0-pr-5
Agent B: PR-6   isolation: worktree   branch: feat/phase-8.0-pr-6
Agent C: PR-7   isolation: worktree   branch: feat/phase-8.0-pr-7
Agent D: PR-8   isolation: worktree   branch: feat/phase-8.0-pr-8

[4 agents 병렬 작업 — 구현 + test + pipeline + commit]
  └─ main에 결과 반환 (worktree path + commit hash)

[main이 순차 머지 — 같은 파일 건드릴 확률 낮음]
  ├ git merge feat/phase-8.0-pr-5 → go test -race → PASS
  ├ git merge feat/phase-8.0-pr-6 → go test -race → PASS
  ├ git merge feat/phase-8.0-pr-7 → go test -race → PASS
  └ git merge feat/phase-8.0-pr-8 → go test -race → PASS

[Wave 종료 → user 확인 1회 → merge to main]
```

---

## 파일 구조 설계 (병렬 머지 충돌 방지)

Wave 4 병렬 wiring이 충돌 없이 성공하려면 초기부터 파일을 **모듈별로 분리** 필수.

```
internal/session/
  event_mapping.go              # PR-3 인프라 (type + register 함수)
  event_mapping_reading.go      # PR-4 배타적 편집
  event_mapping_core.go         # PR-5 배타적 편집
  event_mapping_progression.go  # PR-6 배타적 편집

internal/ws/handlers/
  reading.go                    # PR-4
  core_connection.go            # PR-5
  core_room.go                  # PR-5
  core_ready.go                 # PR-5
  core_clue_interaction.go      # PR-5
  progression_script.go         # PR-6
  progression_hybrid.go         # PR-6
  progression_event.go          # PR-6
  progression_skip_consensus.go # PR-6
  progression_gm_control.go     # PR-6
  progression_consensus_control.go # PR-6
  progression_ending.go         # PR-6

internal/session/
  registry.go                   # PR-3: RegisterModuleHandlers() 팩토리
  registry_reading.go           # PR-4: reading handler/mapping 등록
  registry_core.go              # PR-5: core 4 등록
  registry_progression.go       # PR-6: progression 등록
  registry_snapshot.go          # PR-7

cmd/server/main.go              # PR-1~3이 기본 틀 작성, PR-4부터는 건드리지 않음
                                # session.RegisterAllModuleHandlers(router, manager) 1줄만 호출
```

**핵심 규칙**:
- **main.go는 PR-4 이후 수정 금지** (PR-4가 registry 패턴을 확정)
- 모듈별 registry 파일은 서로 독립 → 병렬 편집 안전
- EventMapping 등록 함수도 모듈별 파일에 분산 → append 방식 아님, 각자 독립

---

## 병렬 리뷰 (4 agent)

Wave 4의 각 PR이 구현 끝난 후, 리뷰 단계에서 **4개 sub-agent 병렬 호출**:

| Agent | Role | 관점 |
|-------|------|------|
| Security reviewer | `superpowers:code-reviewer` 또는 `oh-my-claudecode:security-reviewer` | auth/권한/검증/injection |
| Performance reviewer | `oh-my-claudecode:code-reviewer` | lock contention, allocation, hot path |
| Architecture reviewer | `oh-my-claudecode:critic` 또는 `architect` | design.md 정합성, SOLID, 레이어 분리 |
| Test-coverage reviewer | `oh-my-claudecode:test-engineer` | 누락 시나리오, race, edge case |

한 메시지에 4개 Agent 호출 → 병렬 실행 → 결과 수집 → findings 통합.

**Fix-loop**: 어느 리뷰라도 CRITICAL/HIGH 발견 시 `oh-my-claudecode:executor` sub-agent 호출해 수정 → 재리뷰 → 최대 **3회 반복** → 초과 시 user에 수동 개입 요청.

---

## Merge 전략

1. Wave 내 모든 PR이 구현 + pipeline 완료
2. main이 PR 번호 순으로 순차 머지
3. 각 머지 후 `go test -race -count=1 ./...` 실행
4. 충돌 발생 시 `oh-my-claudecode:executor`에 충돌 해결 위임
5. 모든 머지 성공 → **user 확인 1회** ("Wave 4 머지 완료, 다음 wave 진행?")
6. OK → 다음 wave
7. 실패 → 중단 + 보고

---

## 종료 조건 (Phase 8.0 완료)

- [ ] 9개 PR 모두 main 머지 (5 wave 완료)
- [ ] feature flag 활성화 상태에서 통합 테스트 PASS
- [ ] 12개 모듈 smoke test PASS
- [ ] 한 게임 e2e 시나리오 in-process integration 통과
- [ ] Server restart 복구 시나리오 통과
- [ ] Panic 3회 누적 abort 시나리오 통과
- [ ] Prometheus metric 9종 scrape 가능
- [ ] `memory/project_phase80_progress.md` 최종 갱신
- [ ] checklist.md root 파일 "Phase 8.0 ✅"
