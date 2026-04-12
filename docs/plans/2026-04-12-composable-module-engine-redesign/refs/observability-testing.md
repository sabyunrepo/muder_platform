# Observability & Testing

## Logging (zerolog)

구조화 필드 표준:
- `session_id` — 모든 로그 필수
- `module_id` — 모듈 컨텍스트 있을 때
- `event_id` — 이벤트 처리 로그
- `phase_id` — phase 전환/내 로그
- `err` — 에러 발생 시
- `duration_ms` — 성능 로그

예:
```go
log.Info().
    Str("session_id", sessionID).
    Str("module_id", "cluedist.round").
    Str("phase_id", "round2").
    Int("clues_distributed", 4).
    Msg("round clue distribution complete")
```

## Audit Log

`internal/auditlog/` 는 zerolog 와 별도. 게임 내 의사결정 이벤트를 DB 에 영구 기록:
- 모든 플레이어 action
- 모든 phase 전환
- 모든 win decision
- 모든 module panic
- 모든 rule evaluation (옵션)

용도: 분쟁 해결, 디버깅, 게임 replay, 통계 분석

Schema:
```sql
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  seq BIGINT NOT NULL,
  actor_id UUID,            -- player or "system"
  action VARCHAR(64) NOT NULL,
  module_id VARCHAR(128),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (session_id, seq)
);
```

## Panic Isolation

```
PhaseEngine.dispatch(event)
    │
    ├── defer recover()
    │   └── auditlog.Append(session_id, "module.panic", module_id, stack)
    │   └── session.SetErrorState()
    │
    └── module.Apply(event)   ← panic 발생 지점
```

한 모듈 panic 이 세션 전체 종료로만 이어지고, 다른 세션/서버 프로세스에 전파되지 않음.

## Test Strategy

### Unit (75%+ 커버리지 필수)
- 각 모듈 독립 테스트 — Factory 로 인스턴스 생성, interface mock 으로 의존성 주입
- `internal/engine/` — Core interface 계약 테스트
- `internal/clue/` — ClueGraph 알고리즘 테스트
- `internal/template/` — loader/validator 골든 테스트

### Integration
- Template load → session create → phase run → cleanup (장르당 1 시나리오)
- DB store 테스트 — `testcontainers-go` PostgreSQL

### e2e (PR-V1)
- 4 장르 × 1 프리셋 × 1 세션 smoke
- WebSocket 클라이언트 시뮬, 완주까지 실행

### 모듈 격리 CI 게이트 (PR-V1)
```bash
#!/bin/bash
# 한 모듈 변경 → 다른 모듈 컴파일/테스트 통과 확인
for mod in cluedist decision progression media communication crime_scene; do
    # 다른 모듈만 테스트 (변경된 모듈은 제외)
    go test ./internal/module/... -skip "$mod"
done
```

CI fail 조건: 한 모듈 touch → 다른 모듈 test fail.

## Race Detection

모든 PR 머지 전 `go test -race ./...` 필수. Wave 단위로 일괄 실행.

## Coverage Target

| Area | Target |
|------|--------|
| internal/engine/ | 80% |
| internal/module/** | 75% |
| internal/clue/ | 85% |
| internal/auditlog/ | 80% |
| internal/template/ | 85% (golden tests) |
| apps/web/src/features/editor/ | 70% (vitest) |

## Benchmarks (A4 이후)

- `BenchmarkPhaseEngine_Dispatch` — event throughput
- `BenchmarkRuleEvaluator_JSONLogic` — 룰 평가 성능
- `BenchmarkTemplateLoader_4Genres` — embed load cold start

Regression gate: Phase 8.0 대비 -20% 이상 저하 시 fail.
